const p_status = document.getElementById("p_status");
const p_fen = document.getElementById("p_fen");
const p_pgn = document.getElementById("p_pgn");



const board_darkcolor = "#501010";
const board_lightcolor = "#c0c0e0";
const board_bordercolor = "#803030";
const board_yellowcolor = "#e0e070";
const board_borderwidth = 20;
const board_promote_triangle = 15;
const board_promote_margin = 5;

const board_promotionalpha = 0.6;

const GAMESTAT_WHITE_TO_PLAY = 0;
const GAMESTAT_BLACK_TO_PLAY = 1;

const GAMESTAT_WHITE_WIN_CHECKMATE 	= 2;
const GAMESTAT_BLACK_WIN_CHECKMATE 	= 3;
const GAMESTAT_WHITE_WIN_TIME 		= 4;
const GAMESTAT_BLACK_WIN_TIME 		= 5;
const GAMESTAT_WHITE_WIN_RESIGN 	= 6;
const GAMESTAT_BLACK_WIN_RESIGN 	= 7;

const GAMESTAT_DRAW_NOMOVES_WHITE 						= 8;
const GAMESTAT_DRAW_NOMOVES_BLACK 						= 9;
const GAMESTAT_DRAW_WHITE_INSUFFICIENT_VS_BLACK_TIMEOUT = 10;
const GAMESTAT_DRAW_BLACK_INSUFFICIENT_VS_WHITE_TIMEOUT = 11;
const GAMESTAT_DRAW_50 									= 12;
const GAMESTAT_DRAW_3FOLD 								= 13;
const GAMESTAT_DRAW_SHAKE_HANDS 						= 14;
const GAMESTAT_DRAW_INSUFFICIENT_MAT 					= 15;

const GAMESTAT_DESC = 
[
	"...\nWhite to play",
	"...\nBlack to play",
	"Checkmate!\nWhite wins.",
	"Checkmate!\nBlack wins.",
	"Timeout!\nWhite wins.",
	"Timeout!\nBlack wins.",
	"Resignation!\nWhite wins.",
	"Resignation!\nBlack wins.",
	"Draw!\nWhite has no moves and isn't in check.",
	"Draw!\nBlack has no moves and isn't in check.",
	"Draw!\nWhite has insufficient material VS Black timeout.",
	"Draw!\nBlack has insufficient material VS White timeout.",
	"Draw!\n50 half-moves.",
	"Draw!\nThree-fold repetition.",
	"Draw!\nBy agreement.",
	"Draw!\nInsufficient material."
];

const PIECE_PAWN = 0;
const PIECE_HORSEY = 1;
const PIECE_BISHOP = 2;
const PIECE_ROOK = 3;
const PIECE_QUEEN = 4;
const PIECE_KING = 5;

const SIDE_WHITE = 0;
const SIDE_BLACK = 1;

const DEBUG = 1;

var board_canvas;
var board_ctx;

var board_width = 512;
var board_height = 512;
var board_offx = 50;
var board_offy = 100;

var images = {};
var loading_images = 0;
var loaded_images = 0;

var mouse_x = 0;
var mouse_y = 0;

var mouse_button = false;

var board;

var stockfish;





function encode_coordinates(x, y)
{
	const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
	return files[x] + (y + 1);
}

class Piece
{
	constructor(x, y, piece, side)
	{
		this.x = x;
		this.y = y;
		this.piece = piece;
		this.side = side;
		this.is_lifted = false;
		this.grab_offx = 0;
		this.grab_offy = 0;
		this.legalmoves = [];
	}
	
	draw(board)
	{
		var bx = this.x;
		var by = this.y;
		if (board.facing_side == SIDE_WHITE)
		{
			by = 7 - by;
		}
		else
		{
			bx = 7 - bx;
		}
		if (this.is_lifted)
		{
			board_ctx.globalAlpha = 0.4;
			board_ctx.drawImage(images["pieces"], this.piece * 32, this.side * 32, 32, 32, bx*board_width/8 + board_offx, by*board_height/8 + board_offy, board_width/8, board_height/8);
			board_ctx.globalAlpha = 0.4;
			board_ctx.drawImage(images["pieces"], this.piece * 32, this.side * 32, 32, 32, mouse_x + this.grab_offx, mouse_y + this.grab_offy, board_width/8, board_height/8);
			board_ctx.globalAlpha = 1;
		}
		else
		{
			board_ctx.globalAlpha = 0.8;
			board_ctx.drawImage(images["pieces"], this.piece * 32, this.side * 32, 32, 32, bx*board_width/8 + board_offx, by*board_height/8 + board_offy, board_width/8, board_height/8);
			board_ctx.globalAlpha = 1;
		}
	}
}

class Board
{
	constructor()
	{
		this.pieces = [];
		this.whitescore = 0;
		this.blackscore = 0;
		this.facing_side = SIDE_WHITE;
		this.logic = new LogicBoard();
		this.promotion_prompt = false;
		this.move_from_x = -1;
		this.move_from_y = -1;
		this.move_to_x = -1;
		this.move_to_y = -1;
		this.enable_board = true;
	}

	flip()
	{
		this.facing_side = 1 - this.facing_side;
	}


	


	reconstruct()
	{
		this.pieces = [];
		for (var i = 0; i < 8; i++)
		{
			for (var j = 0; j < 8; j++)
			{
				const p = this.logic.get_piece(i, j);
				const s = this.logic.get_side(i, j);
				if (p != -1)
				{
					var piece = new Piece();
					piece.piece = p;
					piece.side = s;
					piece.x = i;
					piece.y = j;
					piece.legalmoves = this.logic.get_legal_moves(i, j);
					this.pieces.push(piece);
				}
			}
		}
	}

	gameend()
	{
		this.enable_board = false;
		this.promotion_prompt = false;
		resetClocks();
	}

	complete_move()
	{
			if (this.logic.side_to_move === SIDE_WHITE) {
                startWhiteClock();
                stopBlackClock();
            } else if (this.logic.side_to_move === SIDE_BLACK) {
                startBlackClock();
                stopWhiteClock();
            }
		//stockfish.postMessage("position fen \"" + this.logic.get_fen() + "\"");
		//stockfish.postMessage("go");
		this.promotion_prompt = false;
		this.logic.move_piece(this.move_from_x, this.move_from_y, this.move_to_x, this.move_to_y);
		this.logic.compute_state();
		p_status.innerHTML = GAMESTAT_DESC[this.logic.side_to_move];
		p_pgn.innerHTML = "PGN:\n" + this.logic.pgn;
		p_fen.innerHTML = "FEN:\n" + this.logic.get_fen();
		if (this.logic.side_to_move > 2)
		{
			this.gameend();
		}
		this.reconstruct();
	}
	

	moved_piece(p)
	{
		if (p.piece == PIECE_PAWN &&
			((p.side == SIDE_WHITE && this.move_to_y == 7) ||
			(p.side == SIDE_BLACK && this.move_to_y == 0)))
		{
			this.promotion_prompt = true;
		}
		else
		{
			this.complete_move();
		}
	}
	
	unlift_all()
	{
		for (const p of this.pieces)
		{
			if (p.is_lifted)
			{
				p.is_lifted = false;
				const bx = this.board_x(mouse_x);
				const by = this.board_y(mouse_y);
				if (bx >= 0 && by >= 0 && bx < 8 && by < 8 &&
					p.legalmoves.some(item => item[0] == bx && item[1] == by))
				{
					const p2 = this.get_piece(bx, by);
					this.move_is_capture = false;
					if (p2 && p2 != p)
					{
						this.move_is_capture = true;
					}
					this.move_to_x = bx;
					this.move_to_y = by;
					this.move_from_x = p.x;
					this.move_from_y = p.y;
					this.moved_piece(p);
				}
				break;
			}
		}
	}
	
	reset()
	{
		this.pieces = [];
		this.promotion_prompt = false;
		this.move_from_x = -1;
		this.move_from_y = -1;
		this.move_to_x = -1;
		this.move_to_y = -1;
		this.enable_board = true;
		this.logic.reset();
		this.reconstruct();
		this.logic.compute_state();
		p_status.innerHTML = GAMESTAT_DESC[this.logic.side_to_move];
	
	}
	
	reset_stockfish()
	{
		//stockfish.postMessage("ucinewgame");
		//stockfish.postMessage("position fen \"" + board.get_fen() + "\"");
		//stockfish.postMessage("go");
	}

	board_x(x)
	{
		x -= board_offx;
		if (this.facing_side == SIDE_BLACK)
		{
			return 7 - Math.floor(x*8/board_width);
		}
		return Math.floor(x*8/board_width);
	}

	board_y(y)
	{
		y -= board_offy;
		if (this.facing_side == SIDE_WHITE)
		{
			return 7 - Math.floor(y*8/board_height);
		}
		return Math.floor(y*8/board_height);
	}

	visual_x(bx)
	{
		if (this.facing_side == SIDE_BLACK)
		{
			return (7-bx)*board_width/8 + board_offx;
		}
		return bx*board_width/8 + board_offx;
	}

	visual_y(by)
	{
		if (this.facing_side == SIDE_WHITE)
		{
			return (7-by)*board_height/8 + board_offy;
		}
		return by*board_height/8 + board_offy;
	}

	flip_x(x)
	{
		if (this.facing_side == SIDE_WHITE)
		{
			return x;
		}
		return 7-x;
	}

	flip_y(y)
	{
		if (this.facing_side == SIDE_WHITE)
		{
			return 7-y;
		}
		return y;
	}
	
	grab_piece(x, y)
	{
		const bx = this.board_x(x);
		const by = this.board_y(y);
		var p = this.get_piece(bx, by);
		if (p)
		{
			if (p.side != this.logic.side_to_move)
			{
				return null;
			}
			p.is_lifted = true;
			/*p.grab_offx = p.x * board_width / 8 - x;
			p.grab_offy = p.y * board_height / 8 - y;*/
			p.grab_offx = this.visual_x(p.x) - x;
			p.grab_offy = this.visual_y(p.y) - y;
		}
		return p;
	}
	
	get_piece(x, y)
	{
		for (const p of this.pieces)
		{
			if (p.x == x && p.y == y)
			{
				return p;
			}
		}
		return null;
	}
	
	draw_board()
	{
		board_ctx.fillStyle = board_bordercolor;
		board_ctx.fillRect(board_offx - board_borderwidth, board_offy - board_borderwidth, board_width + board_borderwidth * 2, board_height + board_borderwidth * 2);
		for (var i = 0; i < 8; i++)
		{
			for (var j = 0; j < 8; j++)
			{
				board_ctx.fillStyle = (((i+j)%2) == 0) ? board_lightcolor : board_darkcolor;
				board_ctx.fillRect(i*board_width/8 + board_offx, j*board_height/8 + board_offy, board_width/8, board_height/8);
				if ((this.flip_x(i) == this.move_from_x &&
					this.flip_y(j) == this.move_from_y) ||
					(this.flip_x(i) == this.move_to_x &&
					this.flip_y(j) == this.move_to_y))
				{
					board_ctx.globalAlpha = 0.6;
					board_ctx.fillStyle = board_yellowcolor;
					board_ctx.fillRect(i*board_width/8 + board_offx, j*board_height/8 + board_offy, board_width/8, board_height/8);
					board_ctx.globalAlpha = 1;
				}
			}
		}
		const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
		const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];
		board_ctx.fillStyle = "white";
		board_ctx.font = "15px serif";
		board_ctx.textAlign = "center";
		board_ctx.textBaseline = "middle";
		for (var i = 0; i < 8; i++)
		{
			var index = i;
			if (this.facing_side == SIDE_BLACK)
			{
				index = 7 - i;
			}
			board_ctx.fillText(files[index], board_offx + i*board_width/8 + board_width/16, board_offy + board_height + board_borderwidth / 2);
			board_ctx.fillText(ranks[7-index], board_offx - board_borderwidth / 2, board_offy + i*board_height/8 + board_height/16);
		}
	}
	
	draw_pieces()
	{
		for (const p of this.pieces)
		{
			p.draw(this);
		}
	}

	draw_dim()
	{
		board_ctx.fillStyle = "#000000";
		board_ctx.globalAlpha = board_promotionalpha;
		board_ctx.fillRect(0, 0, board_canvas.width, board_canvas.height);
		board_ctx.globalAlpha = 1.0;
	}

	draw_promotion()
	{
		if (this.logic.side_to_move == SIDE_WHITE)
		{
			board_ctx.fillStyle = board_darkcolor;
		}
		else
		{
			board_ctx.fillStyle = board_lightcolor;
		}

		var mx = this.move_to_x;
		var my = 7-this.move_to_y;
		if (this.facing_side == SIDE_BLACK)
		{
			mx = 7-mx;
			my = 7-my;
		}
		const tx = board_offx + board_width/8 * mx + board_width/16;
		const ty = board_offy + board_height/8 * my;
		board_ctx.beginPath();
		board_ctx.moveTo(tx, ty);
		board_ctx.lineTo(tx-board_promote_triangle, ty-board_promote_triangle);
		board_ctx.lineTo(tx+board_promote_triangle, ty-board_promote_triangle);
		board_ctx.lineTo(tx, ty);
		board_ctx.closePath();
		board_ctx.fill();

		var promote_w = board_promote_margin * 2 + board_width / 8;
		var promote_x = tx - 2 * promote_w;
		var promote_y = ty-board_promote_triangle-promote_w;
		if (promote_x < board_offx - board_borderwidth)
		{
			promote_x = board_offx - board_borderwidth;
		}
		else if (promote_x + promote_w * 4 > board_offx + board_width + board_borderwidth)
		{
			promote_x = board_offx + board_width + board_borderwidth - promote_w * 4;
		}
		board_ctx.fillRect(promote_x, promote_y, promote_w*4, promote_w);
		const pieces = [PIECE_HORSEY, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN];
		for (var i = 0; i < 4; i++)
		{
			var hover = false;
			if (mouse_x > promote_x + board_promote_margin &&
				mouse_y > promote_y + board_promote_margin &&
				mouse_x < promote_x + board_promote_margin + board_width / 8 &&
				mouse_y < promote_y + board_promote_margin + board_width / 8)
			{
				hover = true;
			}
			if (hover)
			{
				board_ctx.globalAlpha = 1.0;
			}
			else
			{
				board_ctx.globalAlpha = 0.4;
			}
			if (hover && mouse_button)
			{
				this.logic.promotion_choice = pieces[i];
				this.complete_move();
			}
			board_ctx.drawImage(images["pieces"], pieces[i] * 32, this.logic.side_to_move * 32, 32, 32, 
				promote_x + board_promote_margin, 
				promote_y + board_promote_margin, 
				board_width/8, board_height/8);
			promote_x += promote_w;
		}
		board_ctx.globalAlpha = 1.0;
	}
	
	draw()
	{
		this.draw_board();
		this.draw_pieces();
		if (!this.enable_board)
		{
			this.draw_dim();
		}
		if (this.promotion_prompt)
		{
			this.draw_promotion();
		}
	}
}

function canvas_on_mouse_down(e)
{
	if (e.button != 0)
	{
		return;
	}
	if (!board)
	{
		return;
	}
	if (!board.enable_board)
	{
		return;
	}
	mouse_button = true;
	if (board.grab_piece(mouse_x, mouse_y))
	{
		e.preventDefault();
	}
}

function canvas_on_mouse_move(e)
{
	var rect = board_canvas.getBoundingClientRect();
	mouse_x = e.clientX - rect.left,
	mouse_y = e.clientY - rect.top
}

function canvas_on_mouse_up(e)
{
	if (e.button != 0)
	{
		return;
	}
	if (!board)
	{
		return;
	}
	mouse_button = false;
	board.unlift_all();
}

function draw()
{
	board_ctx.clearRect(0, 0, board_canvas.width, board_canvas.height);
	board.draw();

	mouse_button = false;

	window.requestAnimationFrame(draw);
}

function load_image(name, src)
{
	loading_images++;
	images[name] = new Image();
	images[name].onload = function()
	{
		loaded_images++;
		if (loaded_images == loading_images)
		{
			window.requestAnimationFrame(draw);
		}
	};
	images[name].imagesource = src;
}

function stockfish_message(message)
{
	console.log(message.data);
}

function stockfish_error(message)
{
	console.log("Error");
	console.log(message.data);
}

function init_images()
{
	load_image("pieces", "nupud.png");
	for (var [key, value] of Object.entries(images))
	{
		value.src = value.imagesource;
	}
}

function init_debug()
{
	var b_flipboard = document.createElement("button");
	b_flipboard.innerHTML = "Flip board";
	b_flipboard.onclick = function()
	{
		if (board)
		{
			board.flip();
		}
	};
	var b_resetboard = document.createElement("button");
	b_resetboard.innerHTML = "Reset board";
	b_resetboard.onclick = function()
	{
		if (board)
		{
			board.reset();
			board.reset_stockfish();
		}
	};
	document.getElementById("rightcol").appendChild(b_flipboard);
	document.getElementById("rightcol").appendChild(document.createElement("br"));
	document.getElementById("rightcol").appendChild(b_resetboard);
	document.getElementById("rightcol").appendChild(document.createElement("br"));
}

function init_stockfish()
{
	stockfish = new Worker("stockfish.js");
	stockfish.onmessage = stockfish_message;
	stockfish.onerror = stockfish_error;
	stockfish.postMessage("uci");
}

function init()
{
	board_canvas = document.createElement("canvas");
	board_canvas.width = board_width + 100;
	board_canvas.height = board_height + 200;
	document.getElementById("centercol").appendChild(board_canvas);
	document.body.onmousedown = canvas_on_mouse_down;
	document.body.onmousemove = canvas_on_mouse_move;
	document.body.onmouseup = canvas_on_mouse_up;
	board_ctx = board_canvas.getContext("2d");
	board = new Board();
	board.reset();
	if (DEBUG)
	{
		init_debug();
	}
	init_images();
	init_stockfish();
	board.reset_stockfish();
}





function startWhiteClock() {
	// Get the white clock element
	const whiteClock = document.querySelector('.white-clock .clock-time');
  
	// Set the initial time to 10 minutes

  
	// Update the clock display every second for the white clock
	const intervalId = setInterval(() => {
	  // Decrement the seconds
	  whiteSeconds--;
	  if (whiteSeconds < 0) {
		// If seconds reach 0, decrement the minutes
		whiteMinutes--;
		whiteSeconds = 59;
	  }
  
	  // Update the clock display for the white clock
	  whiteClock.textContent = `${whiteMinutes.toString().padStart(2, '0')}:${whiteSeconds.toString().padStart(2, '0')}`;
  
	  // If minutes and seconds reach 0 for the white clock, stop the interval
	  if (whiteMinutes === 0 && whiteSeconds === 0) {
		clearInterval(intervalId);
	  }
	}, 1000);
  }
  
// Store the interval IDs for the white and black clocks
let whiteIntervalId;
let blackIntervalId;

let whiteClockStarted = false;
let blackClockStarted = false;
let whiteMinutes = 0;
let whiteSeconds = 10;
let blackMinutes = 0;
let blackSeconds = 10;

function startWhiteClock() {
	if (!whiteClockStarted) {
	  // Set the initial time to 10 minutes
	  whiteClockStarted = true;
	}
  
	const whiteClock = document.querySelector('.white-clock .clock-time');
  
	// Update the clock display every second for the white clock
	whiteIntervalId = setInterval(() => {
	  // Decrement the seconds
	  whiteSeconds--;
	  if (whiteSeconds < 0) {
		// If seconds reach 0, decrement the minutes
		whiteMinutes--;
		whiteSeconds = 59;
	  }
  
	  // Update the clock display for the white clock
	  whiteClock.textContent = `${whiteMinutes.toString().padStart(2, '0')}:${whiteSeconds.toString().padStart(2, '0')}`;
  
	}, 1000);
  }

  function startBlackClock() {
	if (!blackClockStarted) {
	  // Set the initial time to 10 minutes
	  blackClockStarted = true;
	}
  
	const blackClock = document.querySelector('.black-clock .clock-time');
  
	// Update the clock display every second for the black clock
	blackIntervalId = setInterval(() => {
	  // Decrement the seconds
	  blackSeconds--;
	  if (blackSeconds < 0) {
		// If seconds reach 0, decrement the minutes
		blackMinutes--;
		blackSeconds = 59;
	  }
  
	  // Update the clock display for the black clock
	  blackClock.textContent = `${blackMinutes.toString().padStart(2, '0')}:${blackSeconds.toString().padStart(2, '0')}`;
  
	  // If minutes and seconds reach 0 for the black clock, set the game status to "Timeout!\nWhite wins."
	  // and stop both clocks
	}, 1000);
  }

function stopWhiteClock() {
  // Use clearInterval() to stop the white clock interval
  clearInterval(whiteIntervalId);
}

function stopBlackClock() {
  // Use clearInterval() to stop the black clock interval
  clearInterval(blackIntervalId);
}


  
let resetCount = 0;

function resetClocks() {
  // Reset the clock times
  whiteMinutes = 10;
  whiteSeconds = 0;
  blackMinutes = 10;
  blackSeconds = 0;

  // Stop the clock intervals
  whiteClock.stop();
  blackClock.stop();

  // Update the clock display
  updateClockDisplay(whiteClock, whiteClockElement);
  updateClockDisplay(blackClock, blackClockElement);

  // Increment the reset count and check if it's greater than 0
  resetCount++;
  if (resetCount > 0) {
    whiteClockStarted = true;
    blackClockStarted = true;
  }
}
init();
