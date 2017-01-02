/*
	Floor planner for Jameson Camp
	Reformed from the WebGL version for simplicity for the user
	Made by Steven O'Riley
*/

// Customized Stuff (Dynamic)
var PARENT_ELEMENT = null;		// Optional parent element (leaving this as null sets automatically has the body append the canvas)
var WIDTH = 640,
	HEIGHT = 480;				// Dimensions for the canvas display
var SCALE_FACTOR = 1 / 2;			// For converting inches into some amount of pixels

var colors = {					// Default colors for everything (though multiple types of things will probably break the rule of referring back to this object)
	floor:"peachpuff",
	
	wood:"rgba(235, 145, 80, 1)",
	woodBorder:"rgba(195, 115, 60, 1)",
	plastic:"rgba(150, 150, 150, 1)",
	plasticBorder:"rgba(120, 120, 120, 1)",
	
	roundTable:"rgba(0, 40, 20, 1)",
	roundTableBorder:"rgba(0, 20, 0, 1)",
	rectangularTable:"#ffc266",
	rectangularTableBorder:"#ffb84d",
	column:"#40340f",
	podium:"brown",
	podiumBorder:"black"
};

var dimensions = {				// Left within the customized area due to the fact that these are all rounded dimensions
	tables: {
		rectangular: {
			x:72,
			y:36
		},
		round: {
			x:36,
			y:36
		}
	},
	chairs: {
		wooden: {
			x:18,
			y:16.75
		},
		plastic: {
			x:23.25,
			y:20.75
		}
	},
	chair: {
		x:22,
		y:19
	},
	column: {
		x:9.5,
		y:9.5
	},
	floor: {
		x:38 * 12,
		y:71 * 12
	},
	podium: {
		x:23 + 5 / 8,
		y:18
	}
}

var create = {						// Important for easy exports/imports (functions appended further below)
};
var availableWoodenChairs = 102,	// Keep track of everything with inital inventory values
	availablePlasticChairs = 88,
	availableGreenTables = 10,
	availableGrayTables = 8,
	availableWoodenRectangularTables = 5,
	availablePodiums = 1;

// Input
var keydowns = [], lastkeys = [];
var mouse = { x:0, y:0, isdown:false, lastdown:false, pressed:{ x:0, y:0, which:1 }, released:{ x:0, y:0, which:1 }, last:{ x:0, y:0 } };
var selected = [];

var columns = [];

window.onkeydown = function(e)
{
	if (keydowns.indexOf(e.keyCode) == -1)
		keydowns.push(e.keyCode);
}
window.onkeyup = function(e)
{
	if (keydowns.indexOf(e.keyCode) != -1)
		keydowns.splice(keydowns.indexOf(e.keyCode), 1);
}
function iskeydown(kc)
{
	return keydowns.indexOf(kc) != -1;
}
function getkeydown(kc)
{
	return keydowns.indexOf(kc) != -1 && lastkeys.indexOf(kc) == -1;
}
function getkeyup(kc)
{
	return keydowns.indexOf(kc) == -1 && lastkeys.indexOf(kc) != -1;
}

function getmousedown(w)
{
	return mouse.isdown && !mouse.lastdown && (typeof w != "undefined" ? mouse.pressed.which == w : true);
}
function getmouseup(w)
{
	return !mouse.isdown && mouse.lastdown && (typeof w != "undefined" ? mouse.pressed.which == w : true);
}

// Main
var mc, ctx;
var camera = { x:0, y:0, scale:{ x:1, y:1 } };
var tables = [];

var otype, addo;
var chs = dimensions.chair.y * SCALE_FACTOR * 1.5;
var areErrors = false;

window.ondragover = function(e)
{
	e.preventDefault();
}

window.ondrop = function(e)
{
	e.preventDefault();
	var f = e.dataTransfer.files[0];
	var reader = new FileReader();
	
	reader.onload = function(){
		readScript( reader.result );
	}
	reader.readAsText(f);
}

window.onload = function()
{
	mc = document.createElement("canvas");
	ctx = mc.getContext("2d");
	mc.width = WIDTH;
	mc.height = HEIGHT;
	mc.style.background = "black";
	
	camera.x = -mc.width / 2 + dimensions.floor.x * SCALE_FACTOR / 2 - 40;
	camera.y = -mc.height / 2 + dimensions.floor.y * SCALE_FACTOR / 2;
	
	mc.onmousedown = function(e)
	{
		mouse.pressed = {
			x:e.pageX - mc.offsetLeft,
			y:e.pageY - mc.offsetTop,
			which:e.which
		}
		mouse.isdown = true;
	};
	mc.onmousemove = function(e)
	{
		mouse.x = e.pageX - mc.offsetLeft;
		mouse.y = e.pageY - mc.offsetTop;
	};
	mc.onmouseup = function(e)
	{
		mouse.released = {
			x:e.pageX - mc.offsetLeft,
			y:e.pageY - mc.offsetTop,
			which:e.which
		}
		mouse.isdown = false;
	};
	mc.oncontextmenu  = function(e)
	{
		e.preventDefault();
	};
	
	otype = document.getElementById("otype");
	otype.innerHTML = "";
	var tys = ["Green Circular Table", "Green Circular Table (Plastic Chairs)", "Gray Table", "Gray Table (Plastic Chairs)", "Wooden Rectangular Table",
				"Wooden Rectangular Table (No Attached Chairs)", "Wooden Rectangular Table (Plastic Chairs)", "Wooden Chair", "Plastic Chair", "Podium"];
	for (var i in tys)
		addType(tys[i]);
	
	addo = document.getElementById("addo");
	addo.onclick = function()
	{
		var ot = otype.value;
		var op = { x:dimensions.floor.x * SCALE_FACTOR / 2, y:dimensions.floor.y * SCALE_FACTOR / 2 };
		
		switch (ot)
		{
			case tys[0]:
				var t = create.greenTable(op);
				if (t)
					tables.push(t);
				break;
			case tys[1]:
				var t = create.greenTableWithPlasticChairs(op);
				if (t)
					tables.push(t);
				break;
			case tys[2]:
				var t = create.grayTable(op);
				if (t)
					tables.push(t);
				break;
			case tys[3]:
				var t = create.grayTableWithPlasticChairs(op);
				if (t)
					tables.push(t);
				break;
			case tys[4]:
				var t = create.woodenRectangularTable(op);
				if (t)
					tables.push(t);
				break;
			case tys[5]:
				var t = create.regularWoodenTable(op);
				if (t)
					tables.push(t);
				break;
			case tys[6]:
				var t = create.woodenRectangularTableWithPlasticChairs(op);
				if (t)
					tables.push(t);
				break;
			case tys[7]:
				var t = create.woodenChair(op);
				if (t)
					tables.push(t);
				break;
			case tys[8]:
				var t = create.plasticChair(op);
				if (t)
					tables.push(t);
				break;
			case tys[9]:
				var t = create.podium(op);
				if (t)
					tables.push(t);
				break;
		}
	};
	
	document.getElementById("instr").onclick = function(){
		alert("This is the Jameson Camp Dining Hall Layout Maker!  In order to get started, choose an object type to add from the dropdown to the right.  Following this, you may click add object, and it will be appended to your layout.  This object may be clicked and dragged in order to be precisely placed, and you can right click to change the property associated with that object (for tables it is the amount of chairs to put at that table, and for simple standalone objects it toggles their rotation).  The layout maker automatically keeps track of all of the resources you've used and can use, alerting you whenver too many are attempted to be placed.");
	};
	document.getElementById("down").onclick = function(){
		if (areErrors)
			alert("There are collision errors that need to be resolved before you can download your layout (a red object signifies incorrect placing)");
		else
			download("layout.txt", createScript());
	};
	
	(PARENT_ELEMENT || document.body).appendChild(mc);
	_loop();
	
	// Columns
	columns.push({ x:12 * 12, y:9 * 12 });
	columns.push({ x:24 * 12, y:9 * 12 });
	
	columns.push({ x:12 * 12, y:25 * 12 });
	columns.push({ x:24 * 12, y:25 * 12 });
	
	columns.push({ x:12 * 12, y:43 * 12 });
	columns.push({ x:24 * 12, y:43 * 12 });
	
	columns.push({ x:12 * 12, y:59 * 12 });
	columns.push({ x:24 * 12, y:59 * 12 });
	
	//
	columns.push({ x:12 * 12, y:0, dim:{ x:144, y:72 }, color:"black", borderColor:"black" });
	
	//
	columns.push({ x:-6, y:6 * 12, dim:{ x:12, y:72 }, color:"#f4a460", borderColor:"black" });
	columns.push({ x:-6, y:16 * 12, dim:{ x:12, y:108 }, color:"brown", borderColor:"black" });
	
	columns.push({ x:-6, y:31 * 12, dim:{ x:12, y:72 }, color:"#f4a460", borderColor:"black" });
	columns.push({ x:-6, y:43 * 12, dim:{ x:12, y:108 }, color:"brown", borderColor:"black" });
	columns.push({ x:-6, y:56 * 12, dim:{ x:12, y:72 }, color:"#f4a460", borderColor:"black" });
	
	//
	var nx = dimensions.floor.x - 6;
	columns.push({ x:nx, y:6 * 12, dim:{ x:12, y:72 }, color:"#f4a460", borderColor:"black" });
	columns.push({ x:nx, y:16 * 12, dim:{ x:12, y:108 }, color:"brown", borderColor:"black" });
	
	columns.push({ x:nx, y:31 * 12, dim:{ x:12, y:72 }, color:"brown", borderColor:"black" });
	columns.push({ x:nx, y:43 * 12, dim:{ x:12, y:108 }, color:"brown", borderColor:"black" });
	columns.push({ x:nx, y:56 * 12, dim:{ x:12, y:72 }, color:"#f4a460", borderColor:"black" });
	
}
create.podium = function(op)
{
	if (availablePodiums == 0)
	{
		alert("You have reached the maximum amount of possible podiums that are available for use");
		return null;
	}
	var t = new Table({ x:op.x || 0, y:op.y || 0, width:dimensions.chair.x * SCALE_FACTOR, height:dimensions.chair.y * SCALE_FACTOR, type:"rectangular", subtype:"chair", oneSided:true, oneSided2:true });
	t.internalType = "podium";
	availablePodiums--;
	t.color = colors.rectangularTable;
	t.borderColor = colors.rectangularTableBorder;
	
	t.onremoval = function()
	{
		availablePodiums++;
	}
	
	return t;
}
create.greenTable = function(op)
{
	if (availableGreenTables == 0)
	{
		alert("You have reached the maximum amount of possible green circular tables that are available for use");
		return null;
	}
	var t = new Table({ x:op.x || 0, y:op.y || 0, radius:dimensions.tables.round.y * SCALE_FACTOR, type:"round" });
	t.internalType = "greenTable";
	availableGreenTables--;
	if (op.plastic)
	{
		t.chairColor = colors.plastic;
		t.chairBorderColor = colors.plasticBorder;
		t.usePlastic = true;
	}
	
	t.onremoval = function()
	{
		availableGreenTables++;
		if (t.usePlastic)
			availablePlasticChairs += t.chairAmount;
		else
			availableWoodenChairs += t.chairAmount;
	}
	t.onchairamountchange = function(o, n)
	{
		var diff = o - n;
		var av = t.usePlastic ? availablePlasticChairs : availableWoodenChairs;
		if (av + diff < 0)
		{
			diff = -av;
			var nd = av + diff;
			this.chairAmount = Math.max(0, this.chairAmount + nd);
			alert("The amount of additional chairs that you have requested be associated with this table is more than that of the amount of remaining ones within your inventory");
		}
		if (t.usePlastic)
			availablePlasticChairs += diff;
		else
			availableWoodenChairs += diff;
	}
	
	return t;
}
create.greenTableWithPlasticChairs = function(op)
{
	op.plastic = true;
	var gt = create.greenTable(op);
	if (gt)
		gt.internalType = "greenTableWithPlasticChairs";
	return gt;
}
create.grayTable = function(op)
{
	if (availableGrayTables == 0)
	{
		alert("You have reached the maximum amount of possible gray circular tables that are available for use");
		return null;
	}
	var t = new Table({ x:op.x || 0, y:op.y || 0, radius:dimensions.tables.round.y * SCALE_FACTOR, type:"round" });
	t.internalType = "grayTable";
	t.color = "gray";
	t.borderColor = "darkgray";
	availableGrayTables--;
	
	if (op.plastic)
	{
		t.chairColor = colors.plastic;
		t.chairBorderColor = colors.plasticBorder;
		t.usePlastic = true;
	}
	
	t.onremoval = function()
	{
		availableGrayTables++;
		if (t.usePlastic)
			availablePlasticChairs += t.chairAmount;
		else
			availableWoodenChairs += t.chairAmount;
	}
	t.onchairamountchange = function(o, n)
	{
		var diff = o - n;
		var av = t.usePlastic ? availablePlasticChairs : availableWoodenChairs;
		if (av + diff < 0)
		{
			diff = -av;
			var nd = av + diff;
			this.chairAmount = Math.max(0, this.chairAmount + nd);
			alert("The amount of additional chairs that you have requested be associated with this table is more than that of the amount of remaining ones within your inventory");
		}
		if (t.usePlastic)
			availablePlasticChairs += diff;
		else
			availableWoodenChairs += diff;
	}
	
	return t;
}
create.grayTableWithPlasticChairs = function(op)
{
	op.plastic = true;
	var gt = create.grayTable(op);
	if (gt)
		gt.internalType = "grayTableWithPlasticChairs";
	return gt;
}
create.woodenRectangularTable = function(op)	// Wooden table with wooden chairs
{
	if (availableWoodenRectangularTables == 0)
	{
		alert("You have reached the maximum amount of possible wooden rectangular tables that are available for use");
		return null;
	}
	var t = new Table({ x:op.x || 0, y:op.y || 0, width:dimensions.tables.rectangular.x * SCALE_FACTOR, height:dimensions.tables.rectangular.y * SCALE_FACTOR, type:"rectangular" });
	t.internalType = "woodenRectangularTable";
	availableWoodenRectangularTables--;
	if (op.plastic)
	{
		t.chairColor = colors.plastic;
		t.chairBorderColor = colors.plasticBorder;
		t.usePlastic = true;
	}
	
	t.onremoval = function()
	{
		if (t.usePlastic)
			availablePlasticChairs += t.chairAmount;
		else
			availableWoodenChairs += t.chairAmount;
		availableWoodenRectangularTables++;
	}
	t.onchairamountchange = function(o, n)
	{
		var diff = o - n;
		
		var av = t.usePlastic ? availablePlasticChairs : availableWoodenChairs;
		if (av + diff < 0)
		{
			diff = -av;
			var nd = av + diff;
			this.chairAmount = Math.max(0, t.chairAmount + nd);
			alert("The amount of additional chairs that you have requested be associated with this table is more than that of the amount of remaining ones within your inventory");
		}
		if (t.usePlastic)
			availablePlasticChairs += diff;
		else
			availableWoodenChairs += diff;
	}
	
	return t;
}
create.woodenRectangularTableWithPlasticChairs = function(op)
{
	op.plastic = true;
	var gt = create.woodenRectangularTable(op);
	if (gt)
		gt.internalType = "woodenRectangularTableWithPlasticChairs";
	return gt;
}
create.woodenChair = function(op)
{
	if (availableWoodenChairs == 0)
	{
		alert("You have reached the maximum amount of possible wooden chairs that are available for use");
		return null;
	}
	var t = new Table({ x:op.x || 0, y:op.y || 0, width:dimensions.chair.x * SCALE_FACTOR, height:dimensions.chair.y * SCALE_FACTOR, type:"rectangular", subtype:"chair", oneSided:true, oneSided2:true });
	t.internalType = "woodenChair";
	availableWoodenChairs--;
	t.color = colors.wood;
	t.borderColor = colors.woodBorder;
	
	t.onremoval = function()
	{
		availableWoodenChairs++;
	}
	
	return t;
}
create.plasticChair = function(op)
{
	if (availablePlasticChairs == 0)
	{
		alert("You have reached the maximum amount of possible plastic chairs that are available for use");
		return null;
	}
	var t = new Table({ x:op.x || 0, y:op.y || 0, width:dimensions.chair.x * SCALE_FACTOR, height:dimensions.chair.y * SCALE_FACTOR, type:"rectangular", subtype:"chair", oneSided:true, oneSided2:true, color:colors.plastic, borderColor:colors.plasticBorder });
	t.internalType = "plasticChair";
	availablePlasticChairs--;
	
	t.onremoval = function()
	{
		availablePlasticChairs++;
	}
	
	return t;
}
create.regularWoodenTable = function(op)
{
	if (availableWoodenRectangularTables == 0)
	{
		alert("You have reached the maximum amount of possible wooden tables that are available for use");
		return null;
	}
	var t = new Table({ x:op.x || 0, y:op.y || 0, width:dimensions.tables.rectangular.x * SCALE_FACTOR, height:dimensions.tables.rectangular.y * SCALE_FACTOR, type:"rectangular", subtype:"nochairs", oneSided:true, oneSided2:true });
	t.internalType = "regularWoodenTable";
	availableWoodenRectangularTables--;
	
	t.onremoval = function()
	{
		availableWoodenRectangularTables++;
	}
	
	return t;
}

function addType(t)
{
	var op = document.createElement("option");
	op.innerHTML = t;
	otype.appendChild(op);
}

function createScript()
{
	var r = "";
	for (var i in tables)
	{
		var t = tables[i];
		r += "tc " + t.x + " " + t.y + " " + t.width + " " + t.height + " " + t.internalType + " " + t.chairAmount + "\n";
	}
	return r;
}
function readScript(s)
{
	var lns = s.split("\n");
	tables = [];
	availableWoodenChairs = 102;
	availablePlasticChairs = 88;
	availableGreenTables = 10;
	availableGrayTables = 8;
	availableWoodenRectangularTables = 5;
	availablePodiums = 1;
	
	for (var i in lns)
	{
		var l = lns[i];
		var ts = l.split(" ");
		
		if (ts[0] == "tc")
		{
			var t = create[ts[5]]({ x:+ts[1], y:+ts[2] });
			t.width = +ts[3];
			t.height = +ts[4];
			changeChairAmount(t, +ts[6]);
			tables.push(t);
		}
	}
}

function _loop()
{
	requestAnimationFrame(_loop);
	mc.width = mc.width;
	hovers = [];
	areErrors = false;
	
	input();
	drawFloor();
	drawColumns();
	doTables();
	doSelected();
	drawAvailability();
	
	lastkeys = keydowns.slice(0);
	mouse.lastdown = mouse.isdown;
	mouse.last.x = mouse.x;
	mouse.last.y = mouse.y;
}

function drawAvailability()
{
	var fs = 14;
	var fp = fs + 2;
	ctx.font = fs + "px Arial";
	
	ctx.fillStyle = "white";
	ctx.fillText("Wooden Chairs Left: " + availableWoodenChairs, 2, fp);
	ctx.fillText("Plastic Chairs Left: " + availablePlasticChairs, 2, fp * 2);
	ctx.fillText("Wooden (Rectangular) Tables Left: " + availableWoodenRectangularTables, 2, fp * 3);
	ctx.fillText("Green Tables Left: " + availableGreenTables, 2, fp * 4);
	ctx.fillText("Gray Tables Left: " + availableGrayTables, 2, fp * 5);
	ctx.fillText("Podiums Left: " + availablePodiums, 2, fp * 6);
	
}

function drawColumns()
{
	for (var i in columns)
	{
		var c = columns[i];
		var sd = typeof c.dim == "undefined" ? { x:(c.x - dimensions.column.x / 2) * SCALE_FACTOR, y:(c.y - dimensions.column.y / 2) * SCALE_FACTOR } : { x:c.x * SCALE_FACTOR, y:c.y * SCALE_FACTOR };
		var dim = typeof c.dim != "undefined" ? { x:c.dim.x * SCALE_FACTOR, y:c.dim.y * SCALE_FACTOR } : { x:dimensions.column.x * SCALE_FACTOR, y:dimensions.column.y * SCALE_FACTOR };
		
		var t = transform(sd);
		ctx.fillStyle = c.color || colors.column;
		ctx.strokeStyle = c.borderColor || colors.column;
		
		ctx.fillRect( t.x, t.y, dim.x * camera.scale.x, dim.y * camera.scale.y );
		ctx.strokeRect( t.x, t.y, dim.x * camera.scale.x, dim.y * camera.scale.y );
	}
}

function changeChairAmount(t, n)
{
	var o = t.chairAmount;
	t.chairAmount = n;
	if (typeof t.onchairamountchange == "function")
		t.onchairamountchange(o, n);
}
function removeTable(t)
{
	if (typeof t.onremoval == "function")
		t.onremoval();
	tables.splice(tables.indexOf(t), 1);
}

function input()
{
	if (iskeydown(32))
	{
		mc.style.cursor = "move";
		if (mouse.isdown && mouse.pressed.which == 1)
		{
			camera.x -= mouse.x - mouse.last.x;
			camera.y -= mouse.y - mouse.last.y;
		}
	}
	else
		mc.style.cursor = "default";
	
	if (getkeydown(46))
	{
		for (var i in selected)
		{
			var t = selected[i];
			removeTable(t);
		}
		selected = [];
	}
}

function doSelected()
{
	var bounds = { x:0, y:0, width:dimensions.floor.x * SCALE_FACTOR, height:dimensions.floor.y * SCALE_FACTOR };
	
	for (var i in selected)
	{
		var s = selected[i];
		var tr = transform(s.x, s.y);
		
		if (s instanceof Table)
		{
			if (mouse.isdown && mouse.pressed.which == 1)
			{
				s.x += mouse.x - mouse.last.x;
				s.y += mouse.y - mouse.last.y;
			}
			
			ctx.fillStyle = "rgba(100, 100, 255, .3)";
			if (s.type == "round")
			{
				ctx.arc(tr.x, tr.y, s.radius * camera.scale.x, 0, 2 * Math.PI);
				ctx.fill();
				ctx.beginPath();
				
				if (s.x - s.radius - chs < bounds.x)
					s.x = bounds.x + s.radius + chs;
				if (s.y - s.radius - chs < bounds.y)
					s.y = bounds.y + s.radius + chs;
				
				if (s.x + s.radius > bounds.x + bounds.width - chs)
					s.x = bounds.x + bounds.width - s.radius - chs;
				if (s.y + s.radius + chs > bounds.y + bounds.height)
					s.y = bounds.y + bounds.height - s.radius - chs;
			}
			else
			{
				ctx.fillRect( tr.x, tr.y, s.width * camera.scale.x, s.height * camera.scale.y );
				
				if (s.x - chs < bounds.x)
					s.x = bounds.x + chs;
				if (s.y - chs < bounds.y)
					s.y = bounds.y + chs;
				
				if (s.x + s.width > bounds.x + bounds.width - chs)
					s.x = bounds.x + bounds.width - chs - s.width;
				if (s.y + s.height > bounds.y + bounds.height - chs)
					s.y = bounds.y + bounds.height - chs - s.height;
			}
			
		}
		
	}
}

function doTables()
{
	var didselect = false;
	
	for (var i = tables.length - 1; i >= 0; i--)
	{
		var t = tables[i];
		
		if (t.type == "round")
		{
			// Check if mouse lies within table
			var um = untransform(mouse);
			var dx = um.x - t.x;
			var dy = um.y - t.y;
			var dist = Math.sqrt(dx * dx + dy * dy);
			
			if (dist <= t.radius)
			{
				if (getmousedown(1) && !didselect)
				{
					if (iskeydown(17) && selected.indexOf(t) == -1)
						selected.push(t);
					else if (selected.length <= 1)
						selected = [t];
					didselect = true;
				}
				else if (getmousedown(3) && !didselect)
				{
					selected = [t];
					didselect = true;
					clearInput();
					
					var chAm = prompt("How many chairs would you like this table to have? (Maximum amount of chairs to a table: 9)");
					if (chAm)
					{
						var n = +chAm;
						if (n > 9)
							alert("The number of chairs you have requested is greater than the maximum allowed (9)");
						
						changeChairAmount(t, Math.round( Math.min( Math.max(+chAm, 0), 9) ) );
					}
				}
			}
			
		}
		else if (t.type == "rectangular")
		{
			var um = untransform(mouse);
			if (liesWithin(um, t))
			{
				if (getmousedown(1) && !didselect)
				{
					if (iskeydown(17) && selected.indexOf(t) == -1)
						selected.push(t);
					else if (selected.length <= 1)
						selected = [t];
					didselect = true;
				}
				else if (getmousedown(3) && !didselect)
				{
					selected = [t];
					didselect = true;
					clearInput();
					
					if (t.subtype == "chair")
					{
						var temp = t.width;
						t.width = t.height;
						t.height = temp;
						t.geometry.width = t.width;
						t.geometry.height = t.height;
					}
					else if (t.subtype == "nochairs")
					{
						var temp = t.width;
						t.width = t.height;
						t.height = temp;
						t.geometry.width = t.width;
						t.geometry.height = t.height;
					}
					else
					{
						var chAm = prompt("How many chairs would you like this table to have? (Maximum amount of chairs to a rectangular table: 8)");
						if (chAm)
						{
							var n = +chAm;
							if (n > 8)
								alert("The number of chairs you have requested is greater than the maximum allowed (8)");
							
							changeChairAmount(t, Math.round( Math.min( Math.max(+chAm, 0), 8) ) );
						}
					}
					
				}
			}
		}
		
		if (getmouseup(3) && !didselect && selected.length > 0)
		{
			var mi = { x:null, y:null };
			clearInput();
			
			for (var i in selected)
			{
				var s = selected[i];
				if (!mi.x)
				{
					mi.x = s.x;
					mi.y = s.y;
				}
				mi.x = Math.min(s.x, mi.x);
				mi.y = Math.min(s.y, mi.y);
			}
			
			var ns = [];
			for (var i in selected)
			{
				var s = selected[i];
				var um = untransform(mouse);
				var nc = { x:s.x - mi.x + um.x, y:s.y - mi.y + um.y };
				if (s.type == "rectangular")
				{
					nc.x -= s.width / 2;
					nc.y -= s.height / 2;
				}
				
				var nt = create[s.internalType]({ x:nc.x, y:nc.y });
				
				if (nt)
				{
					nt.width = s.width;
					nt.height = s.height;
					
					if (nt.subtype == "generic")
						changeChairAmount(nt, s.chairAmount);
					ns.push(nt);
					tables.push(nt);
				}
				else
					break;
			}
			selected = ns;
		}
	}
	
	for (var i in tables)
	{
		var t = tables[i];
		ctx.beginPath();
		
		if (t.type == "round")
		{
			ctx.fillStyle = t.color || colors.roundTable;
			ctx.strokeStyle = t.borderColor || colors.roundTableBorder;
		}
		else
		{
			ctx.fillStyle = t.color || colors.rectangularTable;
			ctx.strokeStyle = t.borderColor || colors.rectangularTableBorder;
		}
		
		ctx.lineWidth = 1;
		var tr = transform(t.x, t.y);
		var err = false;
		
		for (var j in tables)
		{
			var b = tables[j];
			
			if (t != b)
			{
				if (checkCollision(t, b, t.oneSided || b.oneSided, (t.subtype == "chair" && b.type == "rectangular" && b.chairAmount == 0 || t.type == "rectangular" && b.subtype == "chair" && t.chairAmount == 0) ? (t.oneSided2 || b.oneSided2) : false ))
				{
					ctx.fillStyle = "rgba(255, 0, 0, .6)";
					err = true;
					break;
				}
			}
		}
		if (!err)
		{
			for (var i in columns)
			{
				var c = columns[i];
				var temp;
				if (c.color || c.borderColor)
				{
					temp = new Table({ x:c.x * SCALE_FACTOR, y:c.y * SCALE_FACTOR, width:c.dim.x * SCALE_FACTOR, height:c.dim.y * SCALE_FACTOR, type:"rectangular" });
				}
				else
					temp = new Table({ x:(c.x - dimensions.column.x / 2) * SCALE_FACTOR, y:(c.y - dimensions.column.y / 2) * SCALE_FACTOR, width:dimensions.column.x * SCALE_FACTOR, height:dimensions.column.y * SCALE_FACTOR, type:"rectangular" });
				
				if (checkCollision(t, temp, true, t.oneSided2))
				{
					ctx.fillStyle = "rgba(255, 0, 0, .6)";
					err = true;
					break;
				}
			}
		}
		if (err)
			areErrors = true;
		
		if (t.type == "round")
		{
			ctx.arc(tr.x, tr.y, t.radius * camera.scale.x, 0, 2 * Math.PI);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			
			ctx.strokeStyle = "black";
			ctx.moveTo(tr.x - t.radius * camera.scale.x, tr.y);
			ctx.lineTo(tr.x + t.radius * camera.scale.x, tr.y);
			ctx.stroke();
			ctx.beginPath();
			
			var am = t.chairAmount;
			var dim = { x:dimensions.chair.x * SCALE_FACTOR, y:dimensions.chair.y * SCALE_FACTOR };
			dim = { x:dim.x, y:dim.y };
			ctx.fillStyle = t.chairColor || colors.wood;
			ctx.strokeStyle = t.chairBorderColor || colors.woodBorder;
			
			if (am > 0)
			{
				var sep = 360 / am;
				var p = { x:0, y:-t.radius - dim.y - 2 };
				for (var j = 0; j < am; j++)
				{
					var a = rotate(p.x - dimensions.chair.x * SCALE_FACTOR / 2, p.y, sep * j);
					var b = rotate(p.x + dim.x - dimensions.chair.x * SCALE_FACTOR / 2, p.y, sep * j);
					var c = rotate(p.x + dim.x - dimensions.chair.x * SCALE_FACTOR / 2, p.y + dim.y, sep * j);
					var d = rotate(p.x - dimensions.chair.x * SCALE_FACTOR / 2, p.y + dim.y, sep * j);
					a = { x:a.x + t.x, y:a.y + t.y };
					b = { x:b.x + t.x, y:b.y + t.y };
					c = { x:c.x + t.x, y:c.y + t.y };
					d = { x:d.x + t.x, y:d.y + t.y };
					
					drawRect(a, b, c, d);
					ctx.fill();
					ctx.stroke();
					ctx.beginPath();
				}
			}
		}
		else if (t.type == "rectangular")
		{
			ctx.fillRect( tr.x, tr.y, t.width * camera.scale.x, t.height * camera.scale.y );
			ctx.strokeRect( tr.x, tr.y, t.width * camera.scale.x, t.height * camera.scale.y );
			
			var am = t.chairAmount;
			if (am > 0)
			{
				ctx.fillStyle = t.chairColor || colors.wood;
				ctx.strokeStyle = t.chairBorderColor || colors.woodBorder;
				
				var adm = am % 4;
				var eam = (am - adm) / 4;
				var tm = dimensions.chair.y * SCALE_FACTOR - 2;
				var box = { x:tr.x - tm, y:tr.y - tm, width:t.width * camera.scale.x + tm * 2, height:t.height * camera.scale.y + tm * 2 };
				
				for (var j = 0; j < 4; j++)
				{
					var ata = eam;
					if (j < adm)
						ata++;
					var ed = box.width / (ata + 1);
					
					if (j % 2 == 0)
					{
						var ly = box.y + box.height * (j / 2) - dimensions.chair.y * SCALE_FACTOR / 2;
						for (var k = 1; k <= ata; k++)
						{
							var lx = ed * k + box.x + tm - dimensions.chair.x * SCALE_FACTOR * 1.5;
							ctx.fillRect( lx, ly, dimensions.chair.x * SCALE_FACTOR, dimensions.chair.y * SCALE_FACTOR );
							ctx.strokeRect( lx, ly, dimensions.chair.x * SCALE_FACTOR, dimensions.chair.y * SCALE_FACTOR );
						}
					}
					else
					{
						ed = box.height / (ata + 1);
						var lx = box.x + box.width * ((j - 1) / 2) - dimensions.chair.x * SCALE_FACTOR / 2;
						for (var k = 1; k <= ata; k++)
						{
							var ly = ed * k + box.y + tm - dimensions.chair.y * SCALE_FACTOR * 1.5;
							ctx.fillRect( lx, ly, dimensions.chair.y * SCALE_FACTOR, dimensions.chair.x * SCALE_FACTOR );
							ctx.strokeRect( lx, ly, dimensions.chair.y * SCALE_FACTOR, dimensions.chair.x * SCALE_FACTOR );
						}
						
					}
					
				}
				
			}
		}
	}
	
	if (!didselect)
	{
		if (selected.length == 0 && mouse.isdown && mouse.pressed.which == 1 && keydowns.length == 0)
		{
			var a = Math.min(mouse.pressed.x, mouse.x);
			var b = Math.min(mouse.pressed.y, mouse.y);
			var c = Math.max(mouse.pressed.x, mouse.x);
			var d = Math.max(mouse.pressed.y, mouse.y);
			
			ctx.fillStyle = "rgba(150, 150, 150, .5)";
			ctx.fillRect( a, b, c - a, d - b );
		}
		else if (selected.length == 0 && getmouseup(1) && keydowns.length == 0 && (mouse.pressed.x != mouse.x || mouse.pressed.y != mouse.y))
		{
			var a = Math.min(mouse.pressed.x, mouse.x);
			var b = Math.min(mouse.pressed.y, mouse.y);
			var c = Math.max(mouse.pressed.x, mouse.x);
			var d = Math.max(mouse.pressed.y, mouse.y);
			var pa = untransform(a, b);
			var pb = untransform(c, d);
			var r = { x:pa.x, y:pa.y, width:pb.x - pa.x, height:pb.y - pa.y };
			var gt = new Table(r);
			
			for (var i in tables)
			{
				var t = tables[i];
				if (checkCollision(gt, t, true, true))
					selected.push(t);
			}
		}
		else if (getmousedown(1))
			selected = [];
	}
}

function clearInput()
{
	keydowns = [];
	lastkeys = [];
	mouse.isdown = false;
	mouse.lastdown = false;
}

function drawRect(a, b, c, d)
{
	ctx.beginPath();
	var ta = transform(a);
	moveTo(ta);
	lineTo(transform(b));
	lineTo(transform(c));
	lineTo(transform(d));
	lineTo(ta);
}

function moveTo(p)
{
	ctx.moveTo(p.x, p.y);
}
function lineTo(p)
{
	ctx.lineTo(p.x, p.y);
}

function drawFloor()
{
	ctx.fillStyle = colors.floor;
	
	var dim = { x:dimensions.floor.x * SCALE_FACTOR, y:dimensions.floor.y * SCALE_FACTOR };
	var p = transform(0, 0);
	
	ctx.fillRect( p.x, p.y, dim.x * camera.scale.x, dim.y * camera.scale.y );
}

function checkCollision(a, b, sra, srb)
{
	var ga = a.geometry;
	var gb = b.geometry;
	
	var ra = { x:a.x + ga.x, y:a.y + ga.y, width:ga.width, height:ga.height, radius:ga.radius || a.radius };
	var rb = { x:b.x + gb.x, y:b.y + gb.y, width:gb.width, height:gb.height, radius:gb.radius || b.radius };
	
	if (a.type == "rectangular" && b.type == "rectangular")
	{
		if (sra && srb)
			return collideRect(ra, rb);
		if (!sra && !srb)
			return collideRect({ x:ra.x - chs, y:ra.y - chs, width:ra.width + chs * 2, height:ra.height + chs * 2 }, { x:rb.x - chs, y:rb.y - chs, width:rb.width + chs * 2, height:rb.height + chs * 2 });
		else if (!sra)
			return collideRect(ra, { x:rb.x - chs, y:rb.y - chs, width:rb.width + chs * 2, height:rb.height + chs * 2 });
		else if (!srb)
			return collideRect({ x:ra.x - chs, y:ra.y - chs, width:ra.width + chs * 2, height:ra.height + chs * 2 }, rb);
	}
	else if (a.type == "rectangular" && b.type == "round")
		return checkCollision(b, a, sra, srb);
	else if (a.type == "round" && b.type == "rectangular")
	{
		if (!sra)
			rb = { x:rb.x - chs, y:rb.y - chs, width:rb.width + chs * 2, height:rb.height + chs * 2 };
		if (!srb)
			ra.radius += chs;
		return  pointCircle({ x:rb.x, y:rb.y }, ra) ||
				pointCircle({ x:rb.x + rb.width, y:rb.y }, ra) ||
				pointCircle({ x:rb.x + rb.width, y:rb.y + rb.height }, ra) ||
				pointCircle({ x:rb.x, y:rb.y + rb.height }, ra) ||
				
				liesWithin({ x:ra.x - ra.radius, y:ra.y }, rb) ||
				liesWithin({ x:ra.x, y:ra.y - ra.radius }, rb) ||
				liesWithin({ x:ra.x + ra.radius, y:ra.y }, rb) ||
				liesWithin({ x:ra.x, y:ra.y + ra.radius }, rb);
	}
	else if (a.type == "round" && b.type == "round")
	{
		var dx = rb.x - ra.x;
		var dy = rb.y - ra.y;
		var ad = chs * 2;
		if (!sra)
			ad -= chs;
		if (!srb)
			ad -= chs;
		return Math.sqrt(dx * dx + dy * dy) <= ra.radius + rb.radius + chs * 2;
	}
	return false;
}

function collideRect(a, b)
{
	return a.x + a.width >= b.x && a.x <= b.x + b.width && a.y + a.height >= b.y && a.y <= b.y + b.height;
}

function pointCircle(p, c)
{
	var dx = c.x - p.x;
	var dy = c.y - p.y;
	return Math.sqrt(dx * dx + dy * dy) <= c.radius;
}
function liesWithin(p, r)
{
	return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function Table(op)
{
	this.x = op.x || 0;
	this.y = op.y || 0;
	this.radius = op.radius || op.rad || op.r || 1;
	this.width = op.width || 32;
	this.height = op.height || 32;
	this.chairAmount = op.chairAmount || 0;
	this.type = op.type || op.ty || "rectangular";
	this.subtype = op.subtype || "generic";
	this.oneSided = op.oneSided || false;
	this.oneSided2 = op.oneSided2 || false;
	this.color = op.color || null;
	this.borderColor = op.borderColor || null;
	this.chairColor = op.chairColor || null;
	this.chairBorderColor = op.chairBorderColor || null;
	
	(function(){
		if (this.type == "rectangular")
			this.geometry = op.geometry || new Geometry({ x:0, y:0, width:this.width, height:this.height });
		else
			this.geometry = op.geometry || new Geometry({ x:0, y:0, radius:this.radius });
	}).call(this);
}

function Geometry(op)
{
	this.x = op.x || 0;
	this.y = op.y || 0;
	this.width = op.width || op.w || 32;
	this.height = op.height || op.h || 32;
	this.type = op.type || op.ty || "rectangle";
}

// Transformation

function rotate(x, y, d)
{
	var r = d * Math.PI / 180;
	return { x:x * Math.cos(r) - y * Math.sin(r), y:x * Math.sin(r) + y * Math.cos(r) };
}

function transform(x, y)
{
	if (typeof y == "undefined")
	{
		y = x.y;
		x = x.x;
	}
	
	var p = { x:(x - camera.x - mc.width / 2) * camera.scale.x + mc.width / 2,
			  y:(y - camera.y - mc.height / 2) * camera.scale.y + mc.height / 2 };
	return p;
}
function untransform(x, y)
{
	if (typeof y == "undefined")
	{
		y = x.y;
		x = x.x;
	}
	
	var p = { x:(x - mc.width / 2) / camera.scale.x + mc.width / 2 + camera.x,
			  y:(y - mc.height / 2) / camera.scale.y + mc.height / 2 + camera.y };
	return p;
}

//
function download(name, text)
{
    var el = document.createElement("a");
    document.body.appendChild(el);
    el.setAttribute("href", "data:text/plain;charset:utf-8," + encodeURIComponent(text));
    el.setAttribute("download", name);
    el.click();
    document.body.removeChild(el);
}
