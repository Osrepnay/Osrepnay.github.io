"use strict";

let canvas = document.getElementById("graph");
canvas.width = document.getElementsByTagName("body")[0].clientWidth / 2;
let wideness = document.getElementById("wideness");
wideness.value = canvas.width;
canvas.height = Math.floor(window.innerHeight / 2);
let ctx = canvas.getContext("2d");

document.getElementById("too-wide").addEventListener("click", () => {
    canvas.width = wideness.value;
});

let functionBox = document.getElementById("function");
let functionErr = document.getElementById("function-error");
let setpointFunc = (x) => Math.sin(x);
const readFunc = () => {
    let maybeFunc;
    try {
        maybeFunc = new Function("x", functionBox.value);
    } catch (err) {
        functionErr.innerText = err.toString();
        return;
    }
    setpointFunc = maybeFunc;
};
readFunc();
document.getElementById("function-good").addEventListener("click", readFunc);

const cbufProto = {
    at(i) {
        if (i >= this.length || i < 0) {
            throw new RangeError(`Index ${i} out of bounds; expected [0, ${this.length})`);
        }
        const realI = (i + this.startIdx) % this.owmyBackIngArray.length;
        return this.owmyBackIngArray[realI];
    },
    push(elem) {
        if (this.length == this.owmyBackIngArray.length) {
            this.owmyBackIngArray[this.startIdx] = elem;
            this.startIdx++;
            if (this.startIdx >= this.length) {
                this.startIdx = this.startIdx % this.length;
            }
        } else {
            this.owmyBackIngArray[this.length] = elem;
            this.length++;
        }
    },
    last() {
        if (this.startIdx == 0) {
            return this.owmyBackIngArray[this.length - 1];
        } else {
            return this.owmyBackIngArray[this.startIdx - 1];
        }
    },
    resize(newLength) {
        let newOw = new Array(newLength);
        if (this.length <= newLength) {
            for (let i = 0; i < this.length; i++) {
                newOw[i] = this.at(i);
            }
            this.owmyBackIngArray = newOw;
            this.startIdx = 0;
        } else {
            for (let i = 0; i < newLength; i++) {
                newOw[i] = this.at(i + this.length - newLength);
            }
            this.owmyBackIngArray = newOw;
            this.startIdx = 0;
            this.length = newLength;
        }
    },
}
function CBuf(maxLen) {
    this.owmyBackIngArray = new Array(maxLen);
    this.startIdx = 0;
    this.length = 0;
}
Object.assign(CBuf.prototype, cbufProto);

let upsInput = document.getElementById("units-per-second");
let tpuInput = document.getElementById("ticks-per-unit");
let graphWidthInput = document.getElementById("width-units");
let graphHeightInput = document.getElementById("height-units");
let proportionalInput = document.getElementById("proportional");
let integralInput = document.getElementById("integral");
let derivativeInput = document.getElementById("derivative");

const parseFloatV = (badCheck) => (value, orElse) => {
    let res;
    try {
        res = parseFloat(value);
    } catch (_) {
        return orElse;
    }
    if (badCheck(res) || Number.isNaN(res)) {
        return orElse;
    }
    return res;
};

const parseFloatNZ = parseFloatV((x) => x === 0);
const parseFloatNN = parseFloatV((_) => false);

let graphX;
let setpointGraph;
let pvGraph;
let pvCurr;
let pvLastErr; // for kD; consider more samples for derivative?
let pvVelY;
let pvCumErr;
const reset = () => {
    const tpu = parseFloatNZ(tpuInput.value, 10);
    const widthUnits = parseFloatNZ(graphWidthInput.value, 50);
    const ticks = Math.ceil(tpu * widthUnits);
    graphX = 0;
    setpointGraph = new CBuf(ticks);
    setpointGraph.push({x: 0, y: 0});
    pvGraph = new CBuf(ticks);
    pvGraph.push({x: 0, y: 0});
    pvCurr = 0;
    pvLastErr = 0; // for kD; consider more samples for derivative?
    pvVelY = 0;
    pvCumErr = 0;
};
reset();

document.getElementById("broke").addEventListener("click", () => { alert('you fool!'); reset(); });

const resizeGraphs = () => {
    const tpu = parseFloatNZ(tpuInput.value, 10);
    const widthUnits = parseFloatNZ(graphWidthInput.value, 50);
    const ticks = tpu * widthUnits;
    if (setpointGraph.length < ticks) {
        setpointGraph.resize(ticks);
        pvGraph.resize(ticks);
    }
};
graphWidthInput.addEventListener("input", resizeGraphs);
tpuInput.addEventListener("input", resizeGraphs);

let update = () => {
    const ups = parseFloatNZ(upsInput.value, 3.14);
    const tpu = parseFloatNZ(tpuInput.value, 10);
    const tps = ups * tpu;
    const upt = ups / tps;
    const widthUnits = parseFloatNZ(graphWidthInput.value, 50);

    pvCurr += pvVelY;
    pvGraph.push({ x: graphX, y: pvCurr });
    setpointGraph.push({ x: graphX, y: setpointFunc(graphX)});
    graphX += upt;

    const kP = parseFloatNN(proportionalInput.value, 0);
    const kI = parseFloatNN(integralInput.value, 0);
    const kD = parseFloatNN(derivativeInput.value, 0);

    const err = setpointGraph.last().y - pvCurr;
    pvCumErr += err;
    pvVelY += kP * err;
    pvVelY += kI * pvCumErr;
    pvVelY += kD * (err - pvLastErr) / upt; // rise over run :D
    pvLastErr = err;

    // TODO allow updates faster than minimum timeout; batch
    setTimeout(update, 1000 / tps);
};
update();

let draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drawGraph = (graph) => {
        const convert = (coords) => {
            let width = parseFloatNZ(graphWidthInput.value, 50);
            let height = parseFloatNZ(graphHeightInput.value, 1);
            let rightmost = graph.last().x;
            return {
                x: Math.floor(canvas.width * (coords.x - (rightmost - width)) / width),
                y: Math.floor(canvas.height / 2 * (-coords.y / height + 1))
            };
        }
        if (graph.length > 0) {
            ctx.beginPath();
            let {x: startX, y: startY} = convert(graph.last());
            ctx.moveTo(startX, startY);
            for (let i = graph.length - 1; i >= 0; i--) {
                let {x: cx, y: cy} = convert(graph.at(i));
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }
    };
    ctx.strokeStyle = "black";
    drawGraph(setpointGraph);
    ctx.strokeStyle = "red";
    drawGraph(pvGraph);
    window.requestAnimationFrame(draw);
};
window.requestAnimationFrame(draw);
