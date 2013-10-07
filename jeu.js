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

// $(function() {
// 	var canvas = document.getElementById('canvas');
//     var c = canvas.getContext('2d');
// 	c.fillStyle = 'black';
// 	c.fillRect(0,0,16,16);

// 	loadSprites({
// 		f: "img/floor.png",
// 		g: "img/grass.png",
// 		h: "img/hole.png",
// 		s: "img/sand.png",
// 		w: "img/wall.png",
// 	}, function(sprites) {
// 		x = 0;
// 		y = 0;
// 		$.each(sprites, function(name, sprite) {
// 			c.drawImage(sprite,x,y);
// 			x += 16;
// 		});
// 		//
// 	});
// });

$(function() {
	var canvas = document.getElementById('canvas');
    var c = canvas.getContext('2d');
	c.fillStyle = 'black';
	c.fillRect(0,0,16,16);

	level = [
		"hhhhhhhhhhwwwww",
		"wwwwwwwwwwwfffw",
		"wpfffhffffffefw",
		"wwwwwwwwwwwfffw",
		"hhhhhhhhhhwwwww",
		"pfghswe"
	];

	loadSprites({
		p: "img/player.png",
		f: "img/floor.png",
		g: "img/grass.png",
		h: "img/hole.png",
		s: "img/sand.png",
		w: "img/wall.png",
		e: "img/end.png",
	}, function(sprites) {

		for (var y = 0; y < level.length; y++) {
			for (var x = 0; x < level[y].length; x++) {
				c.drawImage(sprites[level[y][x]], x*16, y*16);
			}
		}
	});
});