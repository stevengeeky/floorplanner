/*
	3D view for the Jameson Camp floor planner
	Renders the same layout the 2D canvas edits (the `tables` and `columns`
	globals in main.js) with three.js, so you can walk the room at eye height
	and see whether the aisles are really walkable.

	No state of its own: every frame it reads the 2D data model and updates
	meshes to match. The 2D canvas stays the editing surface.
*/
(function(){
"use strict";

// ---- Constants (inches) -----------------------------------------------------
var EYE_HEIGHT = 65;			// walk camera height
var WALK_SPEED = 60;			// inches per second (a normal walking pace)
var RUN_SPEED = 120;
var TURN_SPEED = Math.PI / 2;	// radians per second with Q/E or arrow keys
var BODY_RADIUS = 9;			// walker's footprint radius for collisions
var H = {						// heights of things
	table:30, seat:18, back:34, column:144, wall:120, podium:46, zone:30
};

// ---- Shared state ------------------------------------------------------------
var state = {
	open:false,
	mode:"orbit",				// "orbit" | "walk"
	people:true,
	zones:true,
	walker:{ x:0, z:0, yaw:0, pitch:0 },
	orbitPos:null
};
var panel, canvas, hint, readout, btnOrbit, btnWalk, mainBtn;
var renderer, scene, camera, controls, floorGroup, tableGroups = new Map();
var keys = {};
var lastT = 0;
var look = { dragging:false, lx:0, ly:0 };
var walkerMesh;
var failed = false;

// px (2D canvas units) -> inches
function IN() { return 1 / SCALE_FACTOR; }
function clearance() { return chs * IN(); }			// the 2D collision band, in inches

// ---- Chair placement: mirrors doTables() in main.js exactly ---------------
// Returns chair centres relative to the table's own origin (top-left for
// rectangular tables, centre for round), in 2D px, plus the 2D rotation in
// degrees (0 = chair back pointing toward -y).
function chairPlacements(t)
{
	var out = [];
	var am = t.chairAmount;
	if (!(am > 0))
		return out;
	var dimx = dimensions.chair.x * SCALE_FACTOR;
	var dimy = dimensions.chair.y * SCALE_FACTOR;

	if (t.type == "round")
	{
		var sep = 360 / am;
		var p = { x:0, y:-t.radius - dimy - 2 };
		for (var j = 0; j < am; j++)
		{
			var c = rotate(0, p.y + dimy / 2, sep * j);
			out.push({ x:c.x, y:c.y, rot:sep * j });
		}
	}
	else
	{
		var adm = am % 4;
		var eam = (am - adm) / 4;
		var tm = dimy - 2;
		var box = { x:-tm, y:-tm, width:t.width + tm * 2, height:t.height + tm * 2 };
		for (var j = 0; j < 4; j++)
		{
			var ata = eam;
			if (j < adm)
				ata++;
			var ed = box.width / (ata + 1);
			if (j % 2 == 0)
			{
				var ly = box.y + box.height * (j / 2) - dimy / 2;
				for (var k = 1; k <= ata; k++)
				{
					var lx = ed * k + box.x + tm - dimx * 1.5;
					out.push({ x:lx + dimx / 2, y:ly + dimy / 2, rot:j == 0 ? 0 : 180 });
				}
			}
			else
			{
				ed = box.height / (ata + 1);
				var lx = box.x + box.width * ((j - 1) / 2) - dimx / 2;
				for (var k = 1; k <= ata; k++)
				{
					var ly = ed * k + box.y + tm - dimy * 1.5;
					out.push({ x:lx + dimy / 2, y:ly + dimx / 2, rot:j == 1 ? -90 : 90 });
				}
			}
		}
	}
	return out;
}

// ---- Mesh builders -----------------------------------------------------------
function lambert(color, extra)
{
	var m = new THREE.MeshLambertMaterial({ color:new THREE.Color(color) });
	if (extra)
		Object.assign(m, extra);
	return m;
}
function box(w, h, d, mat, x, y, z)
{
	var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
	m.position.set(x, y, z);
	return m;
}

// A chair, local origin at the seat centre on the floor, back toward -z.
function buildChair(color)
{
	var g = new THREE.Group();
	var cw = dimensions.chair.x, cd = dimensions.chair.y;
	var mat = lambert(color);
	g.add(box(cw, 1.5, cd, mat, 0, H.seat - 0.75, 0));
	for (var i = 0; i < 4; i++)
		g.add(box(1.2, H.seat - 1.5, 1.2, mat, (i % 2 ? 1 : -1) * (cw / 2 - 1), (H.seat - 1.5) / 2, (i < 2 ? 1 : -1) * (cd / 2 - 1)));
	g.add(box(cw, H.back - H.seat, 1.5, mat, 0, (H.back + H.seat) / 2, -cd / 2 + 0.75));
	g.userData.mats = [mat];
	return g;
}

// Seated person: a capsule from the seat up to head height, for scale.
function buildSeatedPerson()
{
	var geo = new THREE.CapsuleGeometry(7, 18, 4, 12);
	var m = new THREE.Mesh(geo, lambert(0xd9d2c8));
	m.position.set(0, H.seat + 16, 1);
	m.userData.person = true;
	return m;
}

function buildStandingPerson()
{
	var geo = new THREE.CapsuleGeometry(8, EYE_HEIGHT - 16, 4, 12);
	var m = new THREE.Mesh(geo, lambert(0x6aa0e0));
	m.position.y = EYE_HEIGHT / 2;
	return m;
}

function buildTable(t)
{
	var g = new THREE.Group();
	var inch = IN();
	var mats = [];
	var color, zoneShape;

	if (t.type == "round")
	{
		color = t.color || colors.roundTable;
		var r = t.radius * inch;
		var mat = lambert(color);
		mats.push(mat);
		var top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.5, 40), mat);
		top.position.y = H.table - 0.75;
		g.add(top);
		var stem = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, H.table - 1.5, 12), mat);
		stem.position.y = (H.table - 1.5) / 2;
		g.add(stem);
		var base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 1, 24), mat);
		base.position.y = 0.5;
		g.add(base);
		if (!t.oneSided)
		{
			var zr = r + clearance();
			zoneShape = new THREE.Mesh(new THREE.CylinderGeometry(zr, zr, H.zone, 48), zoneMaterial());
			zoneShape.position.y = H.zone / 2;
		}
	}
	else
	{
		var w = t.width * inch, d = t.height * inch;
		color = t.color || colors.rectangularTable;
		var mat = lambert(color);
		mats.push(mat);

		if (t.internalType == "podium")
		{
			g.add(box(w, H.podium, d, mat, w / 2, H.podium / 2, d / 2));
			var top = box(w + 2, 1.5, d + 4, mat, w / 2, H.podium + 0.75, d / 2);
			top.rotation.x = -0.25;
			g.add(top);
		}
		else if (t.subtype == "chair")
		{
			var ch = buildChair(color);
			ch.position.set(w / 2, 0, d / 2);
			if (w < d)
				ch.rotation.y = -Math.PI / 2;
			g.add(ch);
			mats = ch.userData.mats;
			ch.add(buildSeatedPerson());
		}
		else
		{
			g.add(box(w, 1.5, d, mat, w / 2, H.table - 0.75, d / 2));
			var lh = H.table - 1.5;
			for (var i = 0; i < 4; i++)
				g.add(box(2.5, lh, 2.5, mat, (i % 2 ? w - 4 : 4), lh / 2, (i < 2 ? 4 : d - 4)));
			if (t.subtype == "nochairs")
			{
				// a wooden bench-style table: a stretcher between the legs
				g.add(box(w - 8, 3, 2, mat, w / 2, 8, d / 2));
			}
		}
		if (!t.oneSided)
		{
			var c = clearance();
			zoneShape = box(w + c * 2, H.zone, d + c * 2, zoneMaterial(), w / 2, H.zone / 2, d / 2);
		}
	}

	// Chairs placed the way the 2D canvas places them
	var chairColor = t.chairColor || colors.wood;
	var placements = chairPlacements(t);
	var chairs = [];
	for (var i = 0; i < placements.length; i++)
	{
		var p = placements[i];
		var ch = buildChair(chairColor);
		ch.position.set(p.x * inch, 0, p.y * inch);
		ch.rotation.y = -p.rot * Math.PI / 180;
		ch.add(buildSeatedPerson());
		g.add(ch);
		chairs.push({ x:p.x * inch, z:p.y * inch });
	}

	if (zoneShape)
	{
		zoneShape.userData.zone = true;
		zoneShape.renderOrder = 1;
		g.add(zoneShape);
	}
	g.userData.mats = mats;
	g.userData.zone = zoneShape || null;
	g.userData.chairs = chairs;
	return g;
}

function zoneMaterial()
{
	return new THREE.MeshLambertMaterial({ color:0x3b8bff, transparent:true, opacity:0.16, depthWrite:false });
}

function disposeGroup(g)
{
	g.traverse(function(o){
		if (o.geometry)
			o.geometry.dispose();
		if (o.material)
			o.material.dispose();
	});
}

function signature(t)
{
	return [t.type, t.subtype, t.internalType, t.width, t.height, t.radius, t.chairAmount, t.color, t.chairColor, t.oneSided].join("|");
}

// ---- The room (floor, walls, columns) -------------------------------------
function buildRoom()
{
	var g = new THREE.Group();
	var fx = dimensions.floor.x, fz = dimensions.floor.y;
	var inch = IN();

	var floor = new THREE.Mesh(new THREE.PlaneGeometry(fx, fz), lambert(colors.floor));
	floor.rotation.x = -Math.PI / 2;
	floor.position.set(fx / 2, 0, fz / 2);
	g.add(floor);

	// one-foot grid so distances read at a glance
	var pts = [];
	for (var x = 0; x <= fx; x += 12)
		pts.push(x, 0.15, 0, x, 0.15, fz);
	for (var z = 0; z <= fz; z += 12)
		pts.push(0, 0.15, z, fx, 0.15, z);
	var lg = new THREE.BufferGeometry();
	lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
	g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color:0xd8b090 })));

	// translucent walls so the room reads as a room from outside
	var wm = new THREE.MeshLambertMaterial({ color:0xe8e0d8, transparent:true, opacity:0.18, side:THREE.DoubleSide, depthWrite:false });
	var th = 6;
	g.add(box(fx + th * 2, H.wall, th, wm, fx / 2, H.wall / 2, -th / 2));
	g.add(box(fx + th * 2, H.wall, th, wm, fx / 2, H.wall / 2, fz + th / 2));
	g.add(box(th, H.wall, fz, wm, -th / 2, H.wall / 2, fz / 2));
	g.add(box(th, H.wall, fz, wm, fx + th / 2, H.wall / 2, fz / 2));

	// columns come straight from main.js: posts are centred, sized features are top-left
	for (var i = 0; i < columns.length; i++)
	{
		var c = columns[i];
		if (typeof c.dim == "undefined")
		{
			var cx = dimensions.column.x, cz = dimensions.column.y;
			g.add(box(cx, H.column, cz, lambert(colors.column), c.x, H.column / 2, c.y));
		}
		else
		{
			// heights are guesses: the black block is counter height, the wall pieces door height
			var hh = c.color == "black" ? 36 : 84;
			g.add(box(c.dim.x, hh, c.dim.y, lambert(c.color || colors.column), c.x + c.dim.x / 2, hh / 2, c.y + c.dim.y / 2));
		}
	}
	return g;
}

// ---- Sync: 2D model -> 3D scene ---------------------------------------------
function sync()
{
	var inch = IN();
	var seen = new Set();
	for (var i = 0; i < tables.length; i++)
	{
		var t = tables[i];
		seen.add(t);
		var g = tableGroups.get(t);
		var sig = signature(t);
		if (!g || g.userData.sig != sig)
		{
			if (g)
			{
				scene.remove(g);
				disposeGroup(g);
			}
			g = buildTable(t);
			g.userData.sig = sig;
			scene.add(g);
			tableGroups.set(t, g);
		}
		g.position.set(t.x * inch, 0, t.y * inch);

		var isSel = selected.indexOf(t) != -1;
		var em = t.hasError ? 0x7a0000 : (isSel ? 0x1a2a66 : 0x000000);
		for (var j = 0; j < g.userData.mats.length; j++)
			g.userData.mats[j].emissive.setHex(em);
		var z = g.userData.zone;
		if (z)
		{
			z.visible = state.zones;
			z.material.color.setHex(t.hasError ? 0xff3030 : 0x3b8bff);
			z.material.opacity = t.hasError ? 0.3 : 0.16;
		}
	}
	tableGroups.forEach(function(g, t){
		if (!seen.has(t))
		{
			scene.remove(g);
			disposeGroup(g);
			tableGroups.delete(t);
		}
	});
	scene.traverse(function(o){
		if (o.userData.person)
			o.visible = state.people;
	});
}

// ---- Walk camera --------------------------------------------------------------
function obstacles()
{
	var inch = IN();
	var list = [];
	for (var i = 0; i < tables.length; i++)
	{
		var t = tables[i];
		if (t.type == "round")
			list.push({ cx:t.x * inch, cz:t.y * inch, r:t.radius * inch });
		else
			list.push({ x:t.x * inch, z:t.y * inch, w:t.width * inch, d:t.height * inch });
		var g = tableGroups.get(t);
		if (g)
			for (var j = 0; j < g.userData.chairs.length; j++)
				list.push({ cx:t.x * inch + g.userData.chairs[j].x, cz:t.y * inch + g.userData.chairs[j].z, r:11 });
	}
	for (var i = 0; i < columns.length; i++)
	{
		var c = columns[i];
		if (typeof c.dim == "undefined")
			list.push({ x:c.x - dimensions.column.x / 2, z:c.y - dimensions.column.y / 2, w:dimensions.column.x, d:dimensions.column.y });
		else
			list.push({ x:c.x, z:c.y, w:c.dim.x, d:c.dim.y });
	}
	return list;
}
function hits(list, x, z)
{
	for (var i = 0; i < list.length; i++)
	{
		var o = list[i];
		if (o.r !== undefined)
		{
			var dx = o.cx - x, dz = o.cz - z;
			if (dx * dx + dz * dz < (o.r + BODY_RADIUS) * (o.r + BODY_RADIUS))
				return true;
		}
		else
		{
			var px = Math.max(o.x, Math.min(x, o.x + o.w));
			var pz = Math.max(o.z, Math.min(z, o.z + o.d));
			var dx = px - x, dz = pz - z;
			if (dx * dx + dz * dz < BODY_RADIUS * BODY_RADIUS)
				return true;
		}
	}
	return false;
}

function stepWalker(dt)
{
	var w = state.walker;
	var fwd = 0, strafe = 0, turn = 0;
	if (keys.KeyW || keys.ArrowUp) fwd += 1;
	if (keys.KeyS || keys.ArrowDown) fwd -= 1;
	if (keys.KeyD) strafe += 1;
	if (keys.KeyA) strafe -= 1;
	if (keys.KeyQ || keys.ArrowLeft) turn += 1;
	if (keys.KeyE || keys.ArrowRight) turn -= 1;
	w.yaw += turn * TURN_SPEED * dt;

	if (fwd || strafe)
	{
		var speed = (keys.ShiftLeft || keys.ShiftRight) ? RUN_SPEED : WALK_SPEED;
		var len = Math.sqrt(fwd * fwd + strafe * strafe);
		var fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw);		// camera looks down -z at yaw 0
		var rx = Math.cos(w.yaw), rz = -Math.sin(w.yaw);
		var dx = (fx * fwd + rx * strafe) / len * speed * dt;
		var dz = (fz * fwd + rz * strafe) / len * speed * dt;
		var list = obstacles();
		var stuck = hits(list, w.x, w.z);			// a table dragged onto you must not trap you
		var nx = w.x + dx, nz = w.z + dz;
		if (!stuck && hits(list, nx, w.z)) nx = w.x;
		if (!stuck && hits(list, nx, nz)) nz = w.z;
		w.x = Math.max(BODY_RADIUS, Math.min(dimensions.floor.x - BODY_RADIUS, nx));
		w.z = Math.max(BODY_RADIUS, Math.min(dimensions.floor.y - BODY_RADIUS, nz));
	}
	camera.position.set(w.x, EYE_HEIGHT, w.z);
	camera.rotation.set(w.pitch, w.yaw, 0, "YXZ");
}

function feet(v)
{
	var f = Math.floor(v / 12), i = Math.round(v - f * 12);
	if (i == 12) { f++; i = 0; }
	return f + "'" + i + '"';
}

// ---- Loop -----------------------------------------------------------------------
function frame(now)
{
	if (!state.open)
		return;
	requestAnimationFrame(frame);
	var dt = Math.min(0.1, (now - lastT) / 1000 || 0);
	lastT = now;

	sync();
	if (state.mode == "walk")
	{
		stepWalker(dt);
		walkerMesh.visible = false;
		readout.textContent = "eye " + EYE_HEIGHT + '" · standing at ' + feet(state.walker.x) + " across, " + feet(state.walker.z) + " down";
	}
	else
	{
		controls.update();
		walkerMesh.visible = true;
		walkerMesh.position.set(state.walker.x, 0, state.walker.z);
		walkerMesh.rotation.y = state.walker.yaw;
		readout.textContent = "clearance band " + clearance() + '" per side · aisles need ' + (clearance() * 2) + '" between tables';
	}
	renderer.render(scene, camera);
}

// ---- Setup ----------------------------------------------------------------------
function build()
{
	if (renderer || failed)
		return;
	panel = document.createElement("div");
	panel.id = "view3d";
	panel.style.cssText = "display:inline-block;vertical-align:top;margin-left:6px;font:12px Arial,sans-serif;color:#ddd;background:#111;padding:4px;";

	var bar = document.createElement("div");
	bar.style.cssText = "padding:2px 0 4px;";
	btnOrbit = document.createElement("button");
	btnOrbit.textContent = "Orbit (1)";
	btnOrbit.onclick = function(){ setMode("orbit"); };
	btnWalk = document.createElement("button");
	btnWalk.textContent = "Walk (2)";
	btnWalk.onclick = function(){ setMode("walk"); };
	bar.appendChild(btnOrbit);
	bar.appendChild(document.createTextNode(" "));
	bar.appendChild(btnWalk);
	bar.appendChild(check("people", "People (P)", function(v){ state.people = v; }));
	bar.appendChild(check("zones", "Clearance (C)", function(v){ state.zones = v; }));
	panel.appendChild(bar);

	canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	canvas.style.cssText = "display:block;background:#1b1b20;";
	canvas.tabIndex = 0;
	panel.appendChild(canvas);

	hint = document.createElement("div");
	hint.style.cssText = "padding:4px 0 0;color:#aaa;max-width:" + WIDTH + "px;";
	panel.appendChild(hint);
	readout = document.createElement("div");
	readout.style.cssText = "padding:2px 0 0;color:#8fc;";
	panel.appendChild(readout);

	mc.parentNode.insertBefore(panel, mc.nextSibling);

	try
	{
		renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true });
	}
	catch (e)
	{
		failed = true;
		hint.textContent = "WebGL is not available in this browser, so the 3D view cannot render.";
		return;
	}
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	renderer.setSize(WIDTH, HEIGHT, false);

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x1b1b20);
	var fx = dimensions.floor.x, fz = dimensions.floor.y;

	camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 2, 6000);
	camera.position.set(fx / 2 + 260, 520, fz + 420);

	scene.add(new THREE.HemisphereLight(0xffffff, 0x7a5a40, 1.4));
	var sun = new THREE.DirectionalLight(0xffffff, 1.6);
	sun.position.set(300, 700, 500);
	scene.add(sun);

	floorGroup = buildRoom();
	scene.add(floorGroup);

	walkerMesh = buildStandingPerson();
	scene.add(walkerMesh);
	state.walker.x = fx / 2;
	state.walker.z = fz - 48;

	controls = new THREE.OrbitControls(camera, canvas);
	controls.target.set(fx / 2, 0, fz / 2);
	controls.maxPolarAngle = Math.PI / 2 - 0.03;
	controls.enableDamping = true;
	controls.update();

	canvas.addEventListener("mousedown", function(e){
		canvas.focus();
		if (state.mode != "walk")
			return;
		look.dragging = true;
		look.lx = e.clientX;
		look.ly = e.clientY;
		e.preventDefault();
	});
	window.addEventListener("mousemove", function(e){
		if (!look.dragging)
			return;
		state.walker.yaw -= (e.clientX - look.lx) * 0.005;
		state.walker.pitch = Math.max(-1.3, Math.min(1.3, state.walker.pitch - (e.clientY - look.ly) * 0.005));
		look.lx = e.clientX;
		look.ly = e.clientY;
	});
	window.addEventListener("mouseup", function(){ look.dragging = false; });
	canvas.addEventListener("contextmenu", function(e){ e.preventDefault(); });

	setMode("orbit");
}

function check(id, label, onchange)
{
	var l = document.createElement("label");
	l.style.marginLeft = "10px";
	var c = document.createElement("input");
	c.type = "checkbox";
	c.checked = state[id];
	c.id = "view3d-" + id;
	c.onchange = function(){ onchange(c.checked); };
	l.appendChild(c);
	l.appendChild(document.createTextNode(" " + label));
	return l;
}

function setMode(m)
{
	if (!renderer)
		return;
	if (m == "walk" && state.mode == "orbit")
		state.orbitPos = camera.position.clone();
	if (m == "orbit" && state.mode == "walk" && state.orbitPos)
	{
		camera.position.copy(state.orbitPos);
		camera.rotation.set(0, 0, 0);
		controls.update();
	}
	state.mode = m;
	controls.enabled = m == "orbit";
	btnOrbit.style.fontWeight = m == "orbit" ? "bold" : "normal";
	btnWalk.style.fontWeight = m == "walk" ? "bold" : "normal";
	hint.textContent = m == "orbit"
		? "Orbit: drag to spin, wheel to zoom, right-drag to pan. The blue figure is where the walk camera stands."
		: "Walk: W/S or ↑/↓ move, A/D sidestep, Q/E or ←/→ turn, drag to look, Shift to hurry. You cannot walk through tables.";
	if (m == "walk")
		canvas.focus();
}

function open()
{
	build();
	if (failed)
		return;
	if (state.open)
		return;
	state.open = true;
	panel.style.display = "inline-block";
	mainBtn.textContent = "Hide 3D (3)";
	lastT = performance.now();
	requestAnimationFrame(frame);
}
function close()
{
	if (!state.open)
		return;
	state.open = false;
	panel.style.display = "none";
	mainBtn.textContent = "3D View (3)";
}
function toggle()
{
	if (state.open)
		close();
	else
		open();
}

function typingTarget(e)
{
	var n = e.target && e.target.tagName;
	return n == "INPUT" || n == "SELECT" || n == "TEXTAREA";
}

window.addEventListener("keydown", function(e){
	if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e))
		return;
	if (e.key == "3")
	{
		toggle();
		return;
	}
	if (!state.open)
		return;
	if (e.key == "1") setMode("orbit");
	else if (e.key == "2") setMode("walk");
	else if (e.key == "p" || e.key == "P") { state.people = !state.people; document.getElementById("view3d-people").checked = state.people; }
	else if (e.key == "c" || e.key == "C") { state.zones = !state.zones; document.getElementById("view3d-zones").checked = state.zones; }
	keys[e.code] = true;
	if (state.mode == "walk" && /^Arrow/.test(e.code))
		e.preventDefault();
});
window.addEventListener("keyup", function(e){ keys[e.code] = false; });
window.addEventListener("blur", function(){ keys = {}; });

window.addEventListener("load", function(){
	mainBtn = document.getElementById("view3dbtn");
	if (!mainBtn)
	{
		mainBtn = document.createElement("button");
		mainBtn.id = "view3dbtn";
		document.body.insertBefore(mainBtn, document.body.firstChild);
	}
	mainBtn.textContent = "3D View (3)";
	mainBtn.onclick = toggle;
});

// Exposed for the page and for tests
window.view3d = {
	open:open, close:close, toggle:toggle, setMode:setMode,
	chairPlacements:chairPlacements,
	get state(){ return state; },
	get scene(){ return scene; },
	get camera(){ return camera; },
	get groups(){ return tableGroups; },
	get keys(){ return keys; },
	set keys(k){ keys = k; }
};

})();
