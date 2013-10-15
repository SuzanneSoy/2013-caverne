function loadSprites(fileNames, callback) {
	var sprites = {};
	var loaders = [];
	
	$.each(fileNames, function(name, src) {
		var deferred = $.Deferred();
		var	img = new Image();
		img.onload = function() { deferred.resolve(); };
		img.src = src;
		sprites[name] = img;
		loaders.push(deferred.promise());
	});
	
	$.when.apply($, loaders).done(function() { callback(sprites); });
}

// TODO :
// Type system
// Grid cells with {floor: new Floor(), actor: new Actor()}
//   where Floor has 4 "push" input/output directions, 4 input directions and 4 output directions.
// Grid pattern matching? (using the i/o paths that the floor tiles construct)?

function Position(x, y) {
	this.x = x;
	this.y = y;
	this.offsetX = function(offsetX) { return new Position(this.x + offsetX, this.y); }
	this.offsetY = function(offsetY) { return new Position(this.x, this.y + offsetY); }
	this.offset = function(a, b) {
		if (arguments.length == 1) { // Position
			return new Position(this.x + a.x, this.y + a.y);
		} else { // x, y
			return new Position(this.x + a, this.y + b);
		}
	}
	// this.toString = function() { return 'Position(' + x + ', ' + y + ')'; };
}

function Rule(event, condition, action) {
	this.event = event;
	this.condition = condition;
	this.action = action;
}

function Grid(width, height, initializer) {
	for (var x = 0; x < width; x++) {
		this[x] = [];
		for (var y = 0; y < height; y++) {
			this[x][y] = initializer(x, y);
		}
	}

	this.width = width;
	this.height = height;

	this.get = function(a, b) {
		if (b) {
			return this[x][y]; // x, y
		} else {
			return this[a.x][a.y]; // Position
		}
	}

	// toString()
	var that = this;
	this.toString = function() {
		str='[';
		for (var y = 0; y < that.height; y++) {
			str += '[';
			for (var x = 0; x < that.width; x++) {
				str += '[' + that[x][y].join(',') + ']';
			}
			str += '],\n';
		}
		str += ']';
		return str;
	};
}

function Game(sprites) {
	var game = this;
	this.grid = new Grid(38, 25, function(x, y) { return ['h']; });
	this.player = new Position(0, 0);
	this.events = {
		// TODO : make rules instead.
		left:  function() { game.player.x--; },
		up:    function() { game.player.y--; },
		right: function() {
			var current = game.grid.get(game.player);
			var next1 = game.grid.get(game.player.offsetX(1));
			var next2 = game.grid.get(game.player.offsetX(2));
			for (var r = 0; r < game.rules.length; r++) {
				if (game.rules[r].condition(game, current, next1, next2)) {
					console.log("rule", r);
					game.rules[r].action(game, current, next1, next2);
					break;
				}
			}
		},
		down:  function() { game.player.y++; },
	}
	this.rules = [
		// TODO : find a non-awkward way to express rules.
		new Rule('moveToEnd', function(game, current, next1, next2) {
			console.log(next1[1]);
			return (current[1] == 'p') // [?,p]
				&& (next1 != null) && (next1[1] == 'e'); // [e,?]
		}, function(game, current, next1, next2) {
			//game.player.position = next1.position;
			var p = current[1];
			var e = next1[1];
			current.splice(1, 1);// delete starting at 1 a single (1) element;
			next1[1] = p;
			game.player = game.player.offsetX(1); // HACK!
			alert("you win!");
		}),

		new Rule('pushInHole', function(game, current, next1, next2) {
			return (current[1] == 'p') // [?,p]
				&& (next1 != null) && (next1[1] == 'b') // [?,b]
				&& (next2 != null) && (next2[0] == 'h'); // [h,?]
		}, function(game, current, next1, next2) {
			//game.player.position = next1.position;
			var p = current[1];
			var b = next1[1];
			current.splice(1, 1);// delete starting at 1 a single (1) element;
			next1[1] = p;
			next2[0] = b;
			game.player = game.player.offsetX(1); // HACK!
		}),

		new Rule('push', function(game, current, next1, next2) {
			return (current[1] == 'p') // [?,p]
				&& (next1 != null) && (next1[1] == 'b') // [?,b]
				&& (next2 != null) && (next2[1] === undefined); // [?,undefined]
		}, function(game, current, next1, next2) {
			//game.player.position = next1.position;
			var p = current[1];
			var b = next1[1];
			current.splice(1, 1);// delete starting at 1 a single (1) element;
			next1[1] = p;
			next2[1] = b;
			game.player = game.player.offsetX(1); // HACK!
		}),
		
		new Rule('move', function(game, current, next1, next2) {
			return (current[1] == 'p') // [?,p]
				&& (next1 != null) && (next1[1] === undefined); // [?,undefined]
		}, function(game, current, next1, next2) {
			//game.player.position = next1.position;
			var p = current[1];
			current.splice(1, 1);// delete starting at 1 a single (1) element;
			next1[1] = p;
			game.player = game.player.offsetX(1); // HACK!
		}),
	];
	this.event = function(name) {
		this.events[name](this);
	}
}

$(function() {
	var canvas = document.getElementById('canvas');
    var c = canvas.getContext('2d');
	c.fillStyle = 'black';
	c.fillRect(0,0,16,16);

	level = [
		"hhhhhhhhhhwwwww",
		"wwwwwwwwwwwfffw",
		"wpfbfhffffffefw",
		"wwwwwwwwwwwfffw",
		"hhhhhhhhhhwwwww",
		"fghsweb"// + 'p'
	];
	
	loadSprites({
		p: "img/player.png",
		f: "img/floor.png",
		g: "img/grass.png",
		h: "img/hole.png",
		s: "img/sand.png",
		w: "img/wall.png",
		b: "img/block.png",
		e: "img/end.png",
	}, function(sprites) {
		var game = new Game(sprites);
		window.game = game; // For debugging purposes.

		// TODO : remove this and provide a GUI to manage cell's contents.
		for (var y = 0; y < level.length; y++) {
			for (var x = 0; x < level[y].length; x++) {
				if (level[y][x] == 'p') {
					game.player = new Position(x, y);
				}
				
				if ('peb'.indexOf(level[y][x]) != -1) {
					game.grid[x][y] = [ 'f', level[y][x], ];
				} else {
					game.grid[x][y] = [ level[y][x], ];
				}
			}
		}

		game.redraw = function() {
			for (var x = 0; x < game.grid.width; x++) {
				for (var y = 0; y < game.grid.height; y++) {
					c.fillStyle = 'black';
					c.fillRect(x*16, y*16, (x+1)*16, (y+1)*16);
					var cell = game.grid[x][y];
					for (o = 0; o < cell.length; o++) {
						c.drawImage(sprites[cell[o]], x*16, y*16);
					}
				}
			}
		};
		
		game.redraw();

		// Keyboard presses
		$("body").keydown(function(e) {
			switch(e.which) {
			case 37: // left
				game.event('left');
				break;
			case 38: // up
				game.event('up');
				break;
			case 39: // right
				game.event('right');
				break;
			case 40: // down
				game.event('down');
				break;
			}
			game.redraw();
		});
	});
});

// Concepts:
// Actor ?
// Object(s) in grid cell (= grid cell "state")
// Sprite (grid cell + neighborhood are used to choose a cell, for example draw a "border" when the sprite's neighbor's state is different).

// Concepts2:
// Grid (2d-array of stuff), later: grid+paths/zones along which objects can move. Paths are drawn between the centers of two grid cells.
// Tile (image)
// Rule (includes a pattern, and a substitute(?))
