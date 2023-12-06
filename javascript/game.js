var canvas = document.getElementById("render");
var ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false

let mousex;
let mousey;

let DRAW = 1
let DRAWSIZE = 3
let RENDERSTYLE = "classic";
let DRAWSTYLE = "square"
let SOLIDCOLOUR = "black"
let RAINBOW = ["#ff0000", "#ff4000", "#ff8000", "#ffbf00", "#ffff00", "#bfff00", "#80ff00", "#40ff00", "#00ff00", "#00ff40", "#00ff80", "#00ffbf", "#00ffff", "#00bfff", "#0080ff", "#0040ff", "#0000ff", "#4000ff", "#8000ff", "#bf00ff", "#ff00ff", "#ff00bf", "#ff0080", "#ff0040", "#ff0000"]
let MULTITOUCH = true

let firstrun = true

let frame = 0

let lastevent;

let size = 1;

let paused = true

let mousedown = false;

var gridColumns = Math.floor(canvas.width / size);
var gridRows = Math.floor(canvas.height / size);

const gridSizeX = gridColumns; // Number of squares horizontally
const gridSizeY = gridRows; // Number of squares vertically

let array = [];
let updated = [];

let mods = [
    "default.json",
    // "hazardline.json",
    // "rainbowparticles.json",   
    // "static.json",
    // "debug.json",
]

let particles = {
    0:{
        "name": "Air",
        "isstatic": false,
        "density": 0,
        "colour": "#333",
        "text": "Erase",
        "textcolour": "white",
        "backgroundcolour": "#d69da4"
    }
}

for (let mod of mods) {
    let moddata = read(mod)

    try {
        for (let particle of moddata[1]) {
            particles[Object.keys(particles).length] = particle
        }
    } catch {
        for (let particle of moddata) {
            particles[Object.keys(particles).length] = particle
        } 
    }
}

function seedrand(value) {
    rand = new Math.seedrandom(value)
    let returnval = rand.quick()
    delete rand
    return returnval
}

let colours = {}
for (let [id, particle] of Object.entries(particles)) {
    if (typeof(particle.colour) == "object") {
        if (particle.varynumber) {
            let colours = []
            for (let i = 0; i < particle.varynumber; i++) {
                colours.push(varycolour(particles[id].colour[0], particles[id].colour[1]));
            }
            particles[id].colour = colours
        }

        var value = particles[id].colourtype
            .replace(/[^$=!ls&|mxty?@co~>#1234567890=+-/*%\.()]/g, '')
            .replace(/s\?/g, 'seedrand')
            .replace(/l/g, particles[id].colour.length)
            .replace(/&/g, '&&')
            .replace(/=/g, '==')
            .replace(/<==/g, '<=')
            .replace(/>==/g, '>=')
            .replace(/mx/g, 'mousex')
            .replace(/my/g, 'mousey')
            .replace(/\|/g, 'p')
            .replace(/_/g, 'mousedown')
            .replace(/\?/g, 'Math.random()')
            .replace(/~/g, 'Math.round')
            .replace(/#/g, 'frame')
            .replace(/\$/g, 'Math.sign')
            .replace(/@/g, 'u')
            .replace(/ts/g, 'Math.sin')
            .replace(/tc/g, 'Math.cos')
            .replace(/tt/g, 'Math.tan')

        eval(`colours[${id}] = function (y, x, p, u) {return ${value}}`)
    }
}

function clearscreen() {
    array = []
    for (let i = 0; i < gridSizeY; i++) {
        const row = []
        for (let j = 0; j < gridSizeX; j++) {
            row.push(0);
        }
        array.push(row);
    }

    updated = []
    for (let i = 0; i < gridSizeY; i++) {
        const row = []
        for (let j = 0; j < gridSizeX; j++) {
            row.push(0);
        }
        updated.push(row);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

clearscreen()

function update () {
    if (mousedown) {
        draw(lastevent)
    }

    if (!paused) {
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear

        // Fade Out
        // ctx.globalCompositeOperation = "destination-out";
        // ctx.globalAlpha = 0.1;

        // ctx.fillStyle = "rgba(0, 0, 0, 1)";
        // ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ctx.globalAlpha = 1;
        // ctx.globalCompositeOperation = "source-over";
        
        updated = []

        for (let i = 0; i < gridSizeY; i++) {
            const row = []
            for (let j = 0; j < gridSizeX; j++) {
                row.push(0);
            }
            updated.push(row);
        }
        
        if (frame % 2 == 0) { // BTT, LTR
            horizontal = RTL


        } else { //BTT, RTL
            horizontal = LTR

        }

        if (frame % 4 == 0 || frame % 4 == 1) { // BTT, LTR
            vertical = TTB


        } else { //BTT, RTL
            vertical = BTT

        }

        vertical(horizontal)

        render()

        frame++
        requestAnimationFrame(update);
    }
}

function LTR(y, layer) {
    for (let [x, particle] of layer.entries()) {
        if (particle != 0 && particle != undefined) {
            tick(y, x, layer, particle)
        }
    }
}

function RTL(y, layer) {
    for (var x = layer.length - 1; x >= 0; x--) {
        let particle = layer[x]

        if (particle != 0 && particle != undefined) {
            tick(y, x, layer, particle)
        }
    }
}

function TTB(func) {
    for (let [y, layer] of array.entries()) {
        func(y, layer)
    }
}

function BTT(func) {
    for (var y = array.length - 1; y >= 0; y--) {
        let layer = array[y]

        func(y, layer)
    }
}

function tick(y, x, layer, particle) {
    // Check if the current position has been updated
    if (updated[y][x] == 0) {
        // Get the type of the particle, default to "unknown" if not found
        let type = (particles[particle] ?? [{"type": "unknown"}]).type

        if (type == "powder") { // Powder
            // Check if the position below is within bounds, not static, and has lower density
            if (!outOfBounds(y+1, x) && !particles[array[y+1][x]].isstatic && particles[array[y+1][x]].density < particles[particle].density) {
                // Check if the particle should fall due to gravity
                if (Math.random() <= (particles[particle].gravitychance ?? 0.9)) {
                    // Move the particle down
                    array[y][x] = array[y+1][x]
                    array[y+1][x] = particle
                    updated[y][x] = 2
                    updated[y+1][x] = 1
                } else {
                    updated[y][x] = 4
                }
            }
        } else if (type == "dust") { // Dust
            if (!outOfBounds(y+1, x) && !particles[array[y+1][x]].isstatic && particles[array[y+1][x]].density < particles[particle].density) {
                if (Math.random() <= (particles[particle].gravitychance ?? 0.9)) {
                    array[y][x] = array[y+1][x]
                    array[y+1][x] = particle
                    updated[y][x] = 2
                    updated[y+1][x] = 1
                } else {
                    updated[y][x] = 4
                }
            } else {
                // Randomly choose between two possible movement directions
                [function () {
                    if (!outOfBounds(y+1, x+1) && !particles[array[y+1][x+1]].isstatic && particles[array[y+1][x+1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x+1]
                        array[y+1][x+1] = particle
                        updated[y][x] = 2
                        updated[y+1][x+1] = 1
                    } else if (!outOfBounds(y+1, x-1) && !particles[array[y+1][x-1]].isstatic && particles[array[y+1][x-1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x-1]
                        array[y+1][x-1] = particle
                        updated[y][x] = 2
                        updated[y+1][x-1] = 1
                    }
                },
                function () {
                    if (!outOfBounds(y+1, x-1) && !particles[array[y+1][x-1]].isstatic && particles[array[y+1][x-1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x-1]
                        array[y+1][x-1] = particle
                        updated[y][x] = 2
                        updated[y+1][x-1] = 1
                    } else if (!outOfBounds(y+1, x+1) && !particles[array[y+1][x+1]].isstatic && particles[array[y+1][x+1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x+1]
                        array[y+1][x+1] = particle
                        updated[y][x] = 2
                        updated[y+1][x+1] = 1
                    }
                }][Math.round(Math.random())]()
            }
        } else if (type == "gas") { // Gas
            if (!outOfBounds(y-1, x) && !particles[array[y-1][x]].isstatic && particles[array[y-1][x]].density < particles[particle].density) {
                if (Math.random() <= (particles[particle].gravitychance ?? 0.75)) {
                    array[y][x] = array[y-1][x]
                    array[y-1][x] = particle
                    updated[y][x] = 2
                    updated[y-1][x] = 1
                } else {
                    updated[y][x] = 4
                }
            } else {
                // Randomly choose between two possible movement directions
                let returnedvalue = [function () {
                    if (!outOfBounds(y+1, x+1) && !particles[array[y+1][x+1]].isstatic && particles[array[y+1][x+1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x+1]
                        array[y+1][x+1] = particle
                        updated[y][x] = 2
                        updated[y+1][x+1] = 1
                        return true
                    } else if (!outOfBounds(y+1, x-1) && !particles[array[y+1][x-1]].isstatic && particles[array[y+1][x-1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x-1]
                        array[y+1][x-1] = particle
                        updated[y][x] = 2
                        updated[y+1][x-1] = 1
                        return true
                    }
                    return false
                },
                function () {
                    if (!outOfBounds(y+1, x-1) && !particles[array[y+1][x-1]].isstatic && particles[array[y+1][x-1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x-1]
                        array[y+1][x-1] = particle
                        updated[y][x] = 2
                        updated[y+1][x-1] = 1
                        return true
                    } else if (!outOfBounds(y+1, x+1) && !particles[array[y+1][x+1]].isstatic && particles[array[y+1][x+1]].density < particles[particle].density) {
                        array[y][x] = array[y+1][x+1]
                        array[y+1][x+1] = particle
                        updated[y][x] = 2
                        updated[y+1][x+1] = 1
                        return true
                    }
                    return false
                }][Math.round(Math.random())]()

                if (returnedvalue !== true) {
                    // Randomly choose between two possible movement directions
                    [function () {
                        if (!outOfBounds(y, x+1) && !particles[array[y][x+1]].isstatic && particles[array[y][x+1]].density < particles[particle].density) {
                            array[y][x] = array[y][x+1]
                            array[y][x+1] = particle
                            updated[y][x] = 2
                            updated[y][x+1] = 1
                        } else if (!outOfBounds(y, x-1) && !particles[array[y][x-1]].isstatic && particles[array[y][x-1]].density < particles[particle].density) {
                            array[y][x] = array[y][x-1]
                            array[y][x-1] = particle
                            updated[y][x] = 2
                            updated[y][x-1] = 1
                        }
                    },
                    function () {
                        if (!outOfBounds(y, x-1) && !particles[array[y][x-1]].isstatic && particles[array[y][x-1]].density < particles[particle].density) {
                            array[y][x] = array[y][x-1]
                            array[y][x-1] = particle
                            updated[y][x] = 2
                            updated[y][x-1] = 1
                        } else if (!outOfBounds(y, x+1) && !particles[array[y][x+1]].isstatic && particles[array[y][x+1]].density < particles[particle].density) {
                            array[y][x] = array[y][x+1]
                            array[y][x+1] = particle
                            updated[y][x] = 2
                            updated[y][x+1] = 1
                        }
                    }][Math.round(Math.random())]()
                }
            }
        } else if (type == "liquid") { // Liquid
            if (!outOfBounds(y+1, x) && !particles[array[y+1][x]].isstatic && particles[array[y+1][x]].density < particles[particle].density) {
                if (Math.random() <= (particles[particle].gravitychance ?? 0.9)) {
                    array[y][x] = array[y+1][x]
                    array[y+1][x] = particle
                    updated[y][x] = 2
                    updated[y+1][x] = 1
                } else {
                    updated[y][x] = 4
                }
            } else {
                // Randomly choose between two possible movement directions
                let returnedvalue = [function () {
                        if (!outOfBounds(y+1, x+1) && !particles[array[y+1][x+1]].isstatic && particles[array[y+1][x+1]].density < particles[particle].density) {
                            array[y][x] = array[y+1][x+1]
                            array[y+1][x+1] = particle
                            updated[y][x] = 2
                            updated[y+1][x+1] = 1
                            return true
                        } else if (!outOfBounds(y+1, x-1) && !particles[array[y+1][x-1]].isstatic && particles[array[y+1][x-1]].density < particles[particle].density) {
                            array[y][x] = array[y+1][x-1]
                            array[y+1][x-1] = particle
                            updated[y][x] = 2
                            updated[y+1][x-1] = 1
                            return true
                        }
                        return false
                    },
                    function () {
                        if (!outOfBounds(y+1, x-1) && !particles[array[y+1][x-1]].isstatic && particles[array[y+1][x-1]].density < particles[particle].density) {
                            array[y][x] = array[y+1][x-1]
                            array[y+1][x-1] = particle
                            updated[y][x] = 2
                            updated[y+1][x-1] = 1
                            return true
                        } else if (!outOfBounds(y+1, x+1) && !particles[array[y+1][x+1]].isstatic && particles[array[y+1][x+1]].density < particles[particle].density) {
                            array[y][x] = array[y+1][x+1]
                            array[y+1][x+1] = particle
                            updated[y][x] = 2
                            updated[y+1][x+1] = 1
                            return true
                        }
                        return false
                    }][Math.round(Math.random())]()

                if (returnedvalue !== true) {
                    // Randomly choose between two possible movement directions
                    [function () {
                        if (!outOfBounds(y, x+1) && !particles[array[y][x+1]].isstatic && particles[array[y][x+1]].density < particles[particle].density) {
                            array[y][x] = array[y][x+1]
                            array[y][x+1] = particle
                            updated[y][x] = 2
                            updated[y][x+1] = 1
                        } else if (!outOfBounds(y, x-1) && !particles[array[y][x-1]].isstatic && particles[array[y][x-1]].density < particles[particle].density) {
                            array[y][x] = array[y][x-1]
                            array[y][x-1] = particle
                            updated[y][x] = 2
                            updated[y][x-1] = 1
                        }
                    },
                    function () {
                        if (!outOfBounds(y, x-1) && !particles[array[y][x-1]].isstatic && particles[array[y][x-1]].density < particles[particle].density) {
                            array[y][x] = array[y][x-1]
                            array[y][x-1] = particle
                            updated[y][x] = 2
                            updated[y][x-1] = 1
                        } else if (!outOfBounds(y, x+1) && !particles[array[y][x+1]].isstatic && particles[array[y][x+1]].density < particles[particle].density) {
                            array[y][x] = array[y][x+1]
                            array[y][x+1] = particle
                            updated[y][x] = 2
                            updated[y][x+1] = 1
                        }
                    }][Math.round(Math.random())]()
                }
            }
        }

        if ((particles[particle] ?? {"spreadable": "unknown"}).spreadable == true  && ((!outOfBounds(y, x) && array[y][x+1] != particle) || (!outOfBounds(y, x-1) && array[y][x-1] != particle) || (!outOfBounds(y+1, x) && array[y+1][x] != particle) || (!outOfBounds(y-1, x) && array[y-1][x] != particle))) {
            spreadsize = particles[particle].spreadsize ?? 1
            for (let y2 = -spreadsize; y2 <= spreadsize; y2++) {
                for (let x2 = -spreadsize; x2 <= spreadsize; x2++) {
                    if (!outOfBounds(y+y2, x+x2) && (typeof(particles[array[y+y2][x+x2]][particles[particle].name]) == "object")) {
                        if (Math.random() <= particles[array[y+y2][x+x2]][particles[particle].name].spreadchance) {
                            if ((particles[particle].spreadx ?? [1, -1, 0]).includes(Math.sign(y2)) && (particles[particle].spready ?? [1, -1, 0]).includes(Math.sign(x2))) {
                                array[y+y2][x+x2] = particles[array[y+y2][x+x2]][particles[particle].name].spreadparticle ?? particles[particle].spreadparticle ?? particle;
                                updated[y+y2][x+x2] = 3
                            }
                        }

                    } else if (!outOfBounds(y+y2, x+x2) && particles[particle].spreadchance) {
                        if (array[y+y2][x+x2] !== 0 && array[y+y2][x+x2] != particle) {
                            if (Math.random() <= particles[particle].spreadchance) {
                                if ((particles[particle].spreadx ?? [1, -1, 0]).includes(Math.sign(y2)) && (particles[particle].spready ?? [1, -1, 0]).includes(Math.sign(x2))) {
                                    array[y+y2][x+x2] = particles[particle].spreadparticle ?? particle;
                                    updated[y+y2][x+x2] = 3
                                }
                            }
                        }
                    }
                }
            }
        }

        if (particles[particle].changechance) {
            if (Math.random() <= particles[particle].changechance) {
                array[y][x] = particles[particle].changeparticle ?? 0
            }
        }
    }
}

function render() {
    for (let [y, layer] of array.entries()) {
        for (let [x, particle] of layer.entries()) {
            if (particle !== 0) {
                if (RENDERSTYLE == "classic" || RENDERSTYLE == "glow") {
                    try {
                        let colour = particles[particle].colour

                        if (typeof(colour) == "string") { //abc
                            ctx.fillStyle = colour

                        } else if (typeof(colour) == "object") {
                            ctx.fillStyle = colour[(Math.round(colours[particle](y,x,particle, updated[y][x])) % colour.length + colour.length) % colour.length];
                        }
                
                        if (RENDERSTYLE == "glow") {
                            if (particles[particle].shadowblur != undefined) {
                                if ((!outOfBounds(y, x) && array[y][x+1] == 0) || (!outOfBounds(y, x-1) && array[y][x-1] == 0) || (!outOfBounds(y+1, x) && array[y+1][x] == 0) || (!outOfBounds(y-1, x) && array[y-1][x] == 0)) {
                                    ctx.shadowBlur = particles[particle].shadowblur;

                                    if (particles[particle].shadowcolour != undefined) {
                                        ctx.shadowColor = particles[particle].shadowcolour;
                                    } else {
                                        ctx.shadowColor = particles[particle].colour
                                    }
                                } else {
                                    ctx.shadowBlur = 0
                                    ctx.shadowColor = "rgba(0, 0, 0, 0)"
                                }
                            } else {
                                ctx.shadowBlur = 0
                                ctx.shadowColor = "rgba(0, 0, 0, 0)"
                            }
                        }

                        if (particles[particle].bordercolour !== undefined) {
                            if ((outOfBounds(y-1, x) || array[y-1][x] != particle) || (outOfBounds(y+1, x) || array[y+1][x] != particle) || (outOfBounds(y, x+1) || array[y][x+1] != particle) || (outOfBounds(y, x-1) || array[y][x-1] != particle)) {
                                ctx.fillStyle = particles[particle].bordercolour
                            }
                        }

                        ctx.fillRect(x*size, y*size, size, size);

                    } catch { // Invalid element or trouble with texturing.
                        let colour = ["black", "#FF00FF"]
                        ctx.fillStyle = colour[(Math.round(y+x) % colour.length + colour.length) % colour.length];
                        ctx.fillRect(x*size, y*size, size, size);
                    }

                } else if (RENDERSTYLE == "update") {
                    if (updated[y][x] == 0) {
                        ctx.fillStyle = "yellow"
                        ctx.fillRect(x*size, y*size, size, size);
                    } else if (updated[y][x] == 1) {
                        ctx.fillStyle = "red"
                        ctx.fillRect(x*size, y*size, size, size);
                    }  else if (updated[y][x] == 2) {
                        ctx.fillStyle = "blue"
                        ctx.fillRect(x*size, y*size, size, size);
                    } else if (updated[y][x] == 3) {
                        ctx.fillStyle = "green"
                        ctx.fillRect(x*size, y*size, size, size);
                    } else if (updated[y][x] == 4) {
                        ctx.fillStyle = "white"
                        ctx.fillRect(x*size, y*size, size, size);
                    }

                } else if (RENDERSTYLE == "updatestatic") {
                    if (updated[y][x] == 0) {
                        ctx.fillStyle = "yellow"
                        ctx.fillRect(x*size, y*size, size, size);
                    } else if (updated[y][x] == 1) {
                        ctx.fillStyle = "red"
                        ctx.fillRect(x*size, y*size, size, size);
                    }  else if (updated[y][x] == 2) {
                        ctx.fillStyle = "blue"
                        ctx.fillRect(x*size, y*size, size, size);
                    } else if (updated[y][x] == 3) {
                        ctx.fillStyle = "green"
                        ctx.fillRect(x*size, y*size, size, size);
                    } else if (updated[y][x] == 4) {
                        ctx.fillStyle = "white"
                        ctx.fillRect(x*size, y*size, size, size);
                    }

                    if (particles[particle].isstatic == true) {
                        ctx.fillStyle = "purple"
                        ctx.fillRect(x*size, y*size, size, size);
                    }

                } else if (RENDERSTYLE = "rainbow") {
                    ctx.fillStyle = RAINBOW[(Math.round(x+y+frame+particle) % RAINBOW.length + RAINBOW.length) % RAINBOW.length];
                    ctx.fillRect(x*size, y*size, size, size);

                } else {
                    ctx.fillStyle = RENDERSTYLE
                    ctx.fillRect(x*size, y*size, size, size);
                }
            }
        }
    }
}

canvas.addEventListener('contextmenu', event => event.preventDefault());

function draw(event) {
    let mousex, mousey;
    let gridY, gridX;

    for (num in event.touches ?? [1,]) {
        if (num != "item" && num != "length") {
            if (!event.touches) {
                let { x, y } = getMousePos(canvas, event);
                gridX = Math.floor(x / size);
                gridY = Math.floor(y / size);
                mousex = x
                mousey = y

            } else {
                let { x, y } = getTouchPos(canvas, event, num);
                gridX = Math.floor(x / size);
                gridY = Math.floor(y / size);
                mousex = x
                mousey = y
            }

            if (mousedown && (event.button === 0 || event.button === undefined)) {
                if (DRAWSIZE == 0) {
                    if (!outOfBounds(gridY, gridX)) {
                        updated[gridY][gridX] = 1
                        array[gridY][gridX] = DRAW;
                    }
                } else {
                    if (DRAWSTYLE == "square") {
                        for (let y = -DRAWSIZE; y <= DRAWSIZE; y++) {
                            for (let x = -DRAWSIZE; x <= DRAWSIZE; x++) {
                                if (!outOfBounds(gridY+y, gridX+x)) {
                                    updated[gridY+y][gridX+x] = 1
                                    array[gridY+y][gridX+x] = DRAW;
                                }
                            }
                        }
                    } else {
                        if (DRAWSTYLE == "line") {
                            for (let x = -DRAWSIZE; x <= DRAWSIZE; x++) {
                                if (!outOfBounds(gridY, gridX+x)) {
                                    updated[gridY][gridX+x] = 1
                                    array[gridY][gridX+x] = DRAW;
                                }
                            }
                        }
                    }
                }
            }

            if (paused) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                render()
            }
        }
    }
}

window.addEventListener('mousemove', draw, false);
window.addEventListener('touchmove', draw, false);

window.addEventListener('mousedown', (event) => {
    mousedown = true; // Mouse button is being held down
    draw(event)
});

window.addEventListener('touchstart', (event) => {
    mousedown = true; // Mouse button is being held down
    draw(event)
});

window.addEventListener('mouseup', () => {
    mousedown = false; // Mouse button is released
});

window.addEventListener('touchend', () => {
    mousedown = false; // Mouse button is released
});

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    lastevent = evt
    return {
        x: (evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    };
}

function getTouchPos(canvas, evt, num) {
    var rect = canvas.getBoundingClientRect();
    lastevent = evt.touches[num]
    return {
        x: (evt.touches[num].clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        y: (evt.touches[num].clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    };
}

function outOfBounds(y, x) {
    return y > (gridSizeY-1) || x > (gridSizeX-1) || y < 0 || x < 0
}

// UI

document.getElementById("size").oninput = function() {
    document.getElementById("sliderlabel").innerText = "Brush Size: " + (parseInt(this.value) + 1)
    DRAWSIZE = this.value 
};

for (let [id, particle] of Object.entries(particles)) {
    if (particle.picker != false) {
        try {
            document.getElementById(particle.type ?? "solids").insertAdjacentHTML("beforeend",
                `<input type="button" class="materialbutton" id="${particle.name}" value="${particle.text ?? particle.name}" onclick="DRAW=${id}; for (elem of document.getElementsByClassName('materialbutton')) {elem.classList.remove('active')}; this.classList.add('active')" style="background-color: ${particle.backgroundcolour ?? particle.colour ?? "white"}; color: ${particle.textcolour ?? "black"}; background-image: ${`url(${particle.backgroundimage})` ?? "none"};">`
            )
        } catch {
            document.getElementById("buttonslist").insertAdjacentHTML("beforeend",
                `<div id="${particle.type ?? "solids"}" class="buttons"></div>`
            )

            document.getElementById("elementslist").insertAdjacentHTML("beforeend",
                `<option value="${particle.type ?? "solids"}">${(particle.type ?? "solids").charAt(0).toUpperCase() + (particle.type ?? "solids").slice(1)}</option>`
            )

            document.getElementById(particle.type ?? "solids").insertAdjacentHTML("beforeend",
                `<input type="button" class="materialbutton" id="${particle.name}" value="${particle.text ?? particle.name}" onclick="DRAW=${id}; for (elem of document.getElementsByClassName('materialbutton')) {elem.classList.remove('active')}; this.classList.add('active')" style="background-color: ${particle.backgroundcolour ?? particle.colour ?? "white"}; color: ${particle.textcolour ?? "black"}; background-image: ${`url(${particle.backgroundimage})` ?? "none"};">`
            )
        }
    }
    
}

function changerenderstyle(value) {
    if (value != "solid") {
        document.getElementById("solidcolour").hidden = true
        RENDERSTYLE = value
        ctx.shadowBlur = 0
        ctx.shadowColor = "rgba(0, 0, 0, 0)"
    } else {
        if (document.getElementById("solidcolour").hidden) {
            document.getElementById("solidcolour").hidden = false
        } else {
            document.getElementById("solidcolour").hidden = true
        }

        RENDERSTYLE = SOLIDCOLOUR
    }
}

function changeelements(value) {
    for (element of document.getElementsByClassName("buttons")){
        if (element.id == value) {
            element.classList.remove("disabled")

        } else {
            element.classList.add("disabled")
        }
    }
}

changeelements("solids")

function read(url){
    let jsondata;
    $.ajax({
      url: url,
      async: false,
      success: function (data){
        extension = url.split('.').pop()
        if (extension == "yaml" || extension == "yml") {
            try { 
                jsondata = jsyaml.load(data);
            } catch {
                jsondata = data;
            }

        } else {
            // try {
                jsondata = data;
            // } catch {
            //     json = jsyaml.load(data)
            // }

        }
      }
    });
    return jsondata
  }

  function varycolour(color1, color2) {

        // Parse the hex values to integers
        var r1 = parseInt(color1.slice(1, 3), 16);
        var g1 = parseInt(color1.slice(3, 5), 16);
        var b1 = parseInt(color1.slice(5, 7), 16);
      
        var r2 = parseInt(color2.slice(1, 3), 16);
        var g2 = parseInt(color2.slice(3, 5), 16);
        var b2 = parseInt(color2.slice(5, 7), 16);
      
        // Generate random values between the two colors
        var r = Math.floor(Math.random() * (r2 - r1 + 1) + r1);
        var g = Math.floor(Math.random() * (g2 - g1 + 1) + g1);
        var b = Math.floor(Math.random() * (b2 - b1 + 1) + b1);
      
        // Convert back to hex
        var randomColor = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      
        return randomColor;
  }
  
document.getElementById("camerabutton").addEventListener("click", () => {
    const link = document.createElement('a');
    link.download = 'sandbox.png';
    link.href = canvas.toDataURL();
    link.click();
    link.delete;
});
