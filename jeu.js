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

// Type System

var Type = {
	// Primitive types
	Void: function() { return { primitive: "Void" }; },
	Unit: function() { return { primitive: "Unit" }; },
	Int: function() { return { primitive: "Int" }; },
	Struct: function(fields) { // Type.Struct({ a: Type.Int(), b: Type.Unit(), c: ... })
		return {
			primitive: "Struct",
			fields: fields,
		};
	},
	Function: function(parameterTypes, returnType) { // Type.Function([Type.Int(), Type.Int()], Type.Int())
		return {
			primitive: "Function",
			parameterTypes: parameterTypes,
			returnType: returnType,
		};
	},
	Either: function(taggedUnion) { // Type.Either({ something: Type.SomeType(...), nothing: Type.Unit() });
		return {
			primitive: "Either",
			taggedUnion: taggedUnion,
		};
	},
	Map: function(fromName, fromType, toName, toType) {
		return {
			primitive: "Map",
			fromName: fromName,
			fromType: fromType,
			toName: toName,
			toType: toType,
		};
	},
	// User-defined types
	Maybe: function(type) {
		return Type.Either({
			something: type,
			nothing: Type.Unit()
		});
	},
	Enum: function(symbols) {
		var assoc = {}
		for (var i = 0; i < symbols.length; i++) {
			assoc[i] = Type.Unit();
		}
		return Pattern.Either(assoc);
	},
	Boolean: function() {
		return Type.Enum([
			'true',
			'false'
		]);
	}
};

var Pattern = {
	Any: function() { return function(value) { return true; }; },
	Void: function() { return function(value) { return false; }; }, // Void can never have a value.
	Predicate: function(predicate) { return predicate; },
	Unit: function() { return function(value) { return value.primitive == "Unit"; }; },
	AnyInt: function() { return function(value) { return value.primitive == "Int"; }; },
	Int: function(intValue) { return function(value) { return value.primitive == "Int" && value.value == intValue; }; },
	Struct: function(fields) { // Pattern.Struct({ a: Pattern.Int(), b: Pattern.Unit(), c: ... })
		return function(value) {
			if (value.primitive != "Struct") { return false; }
			for (f in fields) { if (!fields[f](value.fields[f])) { return false; } }
			for (f in value.fields) { if (!fields[f]) { return false; } } // Check `value` doesn't have extra fields.
			return true;
		};
	},
	Function: function(parameterTypes, returnType) { // Pattern.Function([Pattern.Int(), Pattern.Int()], Pattern.Int())
		return function(value) {
			if (value.primitive != "Function") { return false; }
			if (!returnType(value.returnType)) { return false; }
			if (parameterTypes.length != value.parameterTypes.length) { return false; }
			for (var i = 0; i < parameterTypes; i++) {
				if (!parameterTypes[i](value.parameterTypes[i])) { return false; }
			}
			return true;
		};
	},
	Either: function(taggedUnion) { // Pattern.Either({ something: Pattern.SomeType(...), nothing: Pattern.Unit()});
		return function(value) {
			if (value.primitive != "Either") { return false; }
			if (!taggedUnion[value.tag]) { return false; }
			return taggedUnion[value.tag](value.value);
		};
	},
	OneOf: function(untaggedUnion) {
		return function(value) {
			for (i = 0; i < untaggedUnion.length; i++) {
				if (untaggedUnion[i](value)) {
					return true;
				}
			}
			return false;
		}
	},
	// User-defined patterns
	Maybe: function(pattern) {
		return Pattern.OneOf([
			pattern,
			Pattern.Unit()
		]);
	},
};

var Value = {
	// Void can't ever have a value.
	Unit: function() { return { primitive: "Unit" }; },
	Int: function(value) { return { primitive: "Int", value: value }; },
	Struct: function(fields) { // Value.Struct({ a: Value.Int(42), b: Value.Unit(), c: ... })
		return {
			primitive: "Struct",
			fields: fields,
		};
	},
	Function: function(parameterTypes, returnType, body) { // Value.Function([Type.Int(), Type.Int()], Type.Int(), body)
		return {
			primitive: "Function",
			parameterTypes: parameterTypes,
			returnType: returnType,
			body: body,
		};
	},
	Either: function(tag, value) { // Value.Either("something", Value.SomeType(...));
		return {
			primitive: "Either",
			tag: tag,
			value: value,
		};
	},
};

(function() {
	var maybeCellType = Type.Maybe(Type.Int());
	var maybeCellPattern = Pattern.Maybe(Pattern.AnyInt());
	var cellValue = Value.Int(42);
	var eitherCellPattern = Pattern.Either({ cell: Pattern.AnyInt(), foobar: Pattern.AnyInt() });
	var eitherCellValue = Value.Either("cell", cellValue);
	if (console) {
		console.log(true, maybeCellPattern(cellValue));
		console.log(false, maybeCellPattern(eitherCellValue));
		console.log(true, eitherCellPattern(eitherCellValue));
	}
})();

// DONE :
// Type system: Types, Pattern matching and Values
// Grid cells with {floor: new Floor(), actor: new Actor()}
//   where Floor has 4 "push" input/output directions, 4 input directions and 4 output directions.
// TODO :
// Type system:
//   creating patterns from types,
//   verifying if a value is of the given type,
//   verifying if a pattern is matches against values of the given type.
// Type system:
//   Maybe, Either and OrElse have slightly different meanings.
//   Display types, values and patterns.
// Grid pattern matching:
//   using relative up/right/down/left grid positions, and absolute coordinates
//   Then, using the i/o paths that the floor tiles construct
// TODO: the i/o paths we currently have do not allow for teleports.

var GameType = {};

GameType.Direction = Type.Enum([
	'up',
	'down',
	'left',
	'right',
]);

GameType.FloorTile = Type.Enum([
	'floor',
	'grass',
	'hole',
	'sand',
	'wall',
	'filledhole',
]);

GameType.Floor = Type.Struct({
	tile: GameType.FloorTile,
	push: Type.Map('in', GameType.Direction, 'out', GameType.Direction),
	allowedIn: Type.Map('in', GameType.Direction, 'allowed', Type.Boolean()),
	allowedOut: Type.Map('out', GameType.Direction, 'allowed', Type.Boolean()),
});

GameType.TriggerTile = Type.Enum([
	'end',
]);

GameType.ActorTile = Type.Enum([
	'player',
	'block',
]);

GameType.Cell    = Type.Struct({
	floor: GameType.Floor,
	trigger: Type.Maybe(GameType.Trigger),
	actor: Type.Maybe(GameType.Actor),
});

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
