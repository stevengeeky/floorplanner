# Floor Planner

A virtual floor planner for [Jameson Camp](http://jamesoncamp.org). Collision detection is based upon the amount of room that people have to stand or sit around the table.

## Usage

Simply add a table and right click it to add chairs, or just add a bunch of stuff to get started.

Open `index.html` straight from disk; nothing needs a server or a network connection.

### 2D (the editing surface)

- **Add Object** puts the chosen thing in the middle of the room.
- **Left-drag** a thing to move it. **Ctrl-click** adds to the selection; drag on empty floor to box-select.
- **Right-click** a table to set how many chairs it has (up to 9 round, 8 rectangular); right-click a chair, podium or bare table to rotate it.
- **Right-click on empty floor** with things selected to duplicate them there.
- **Delete** removes the selection. **Space + drag** pans.
- A thing turns **red** when something (a person's seat, a column, a wall feature) does not have room: 28.5" around every table with chairs, so two tables need 57" between them.
- **Download** saves `layout.txt` once nothing is red. **Drop** a saved `layout.txt` onto the page to load it.

### 3D (to see whether the layout would work)

Press **3** or the **3D View** button to open a three-dimensional view of the same layout beside the plan. It is a live mirror of the plan: drag a table in 2D and it moves in 3D at once. There is no separate 3D state to keep in sync.

- **1 · Orbit camera** — drag to spin, wheel to zoom, right-drag to pan. The blue figure is where the walk camera is standing.
- **2 · Walk camera** — you stand at eye height (65") in the room. **W/S** or **↑/↓** walk, **A/D** sidestep, **Q/E** or **←/→** turn, drag in the view to look around, hold **Shift** to hurry. You cannot walk through tables, chairs or columns, so if an aisle is too tight you will be stopped by it.
- **C · Clearance** — shows the 28.5" band the collision rule gives each table as a translucent volume; it turns red on the tables that are in conflict, and a tight aisle shows as two bands touching.
- **P · People** — seated placeholders at every chair for scale.

Sizes are real: 72×36" and 36" round tables, 22×19" chairs, 9.5" posts, a 38'×71' floor with a one-foot grid.

## Files

- `scripts/main.js` — the 2D planner (the data model lives here).
- `scripts/view3d.js` — the 3D view; reads `tables` and `columns` from `main.js` every frame.
- `scripts/vendor/` — three.js r186 and OrbitControls, wrapped as classic scripts so the page works from `file://`. `revendor.mjs` regenerates them from a newer release; it is not part of running the planner.
