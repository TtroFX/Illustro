import { readFileSync, writeFileSync } from 'node:fs';

const path = 'public/m8-selection-launcher.css';
const source = readFileSync(path, 'utf8');
if (!source.includes('.m8e-vector-preview-curve {')) {
  writeFileSync(
    path,
    `${source.trimEnd()}\n\n${String.raw`
.m8e-vector-preview-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.m8e-vector-preview-curve {
  fill: none;
  stroke: #5d6cda;
  stroke-width: 2.5;
  vector-effect: non-scaling-stroke;
}

.m8e-vector-preview-handle-line {
  stroke: #a9aec5;
  stroke-width: 1.2;
  stroke-dasharray: 4 3;
  vector-effect: non-scaling-stroke;
}

.m8e-vector-preview-handle {
  fill: #fff;
  stroke: #9098ba;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.m8e-vector-preview-node {
  fill: #fff;
  stroke: #5868d4;
  stroke-width: 2.4;
  vector-effect: non-scaling-stroke;
}

.m8e-vector-preview-node.is-smooth {
  rx: 7px;
  fill: #eeeaff;
  stroke: #815bd0;
}

.m8e-text-preview-box {
  position: absolute;
  top: 38%;
  left: 26%;
  min-width: 330px;
  min-height: 92px;
  padding: 19px 22px;
  border: 1.5px solid #6e7fea;
  border-radius: 5px;
  background: rgb(255 255 255 / 12%);
  color: #303646;
  font: 600 34px/1.35 system-ui, sans-serif;
  letter-spacing: .01em;
  pointer-events: none;
}

.m8e-text-preview-box > span {
  position: relative;
  z-index: 1;
}

.m8e-text-preview-box > i {
  display: inline-block;
  width: 1.5px;
  height: 1.05em;
  margin-left: 2px;
  background: #4757cb;
  vertical-align: -.12em;
  animation: m8e-text-caret 920ms steps(1, end) infinite;
}

.m8e-text-preview-handle {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 2px solid #fff;
  background: #6474e4;
  box-shadow: 0 1px 4px rgb(40 45 74 / 24%);
  transform: translate(-50%, -50%);
}

.m8e-text-preview-handle[data-corner="nw"] {
  top: 0;
  left: 0;
}

.m8e-text-preview-handle[data-corner="ne"] {
  top: 0;
  left: 100%;
}

.m8e-text-preview-handle[data-corner="se"] {
  top: 100%;
  left: 100%;
}

.m8e-text-preview-handle[data-corner="sw"] {
  top: 100%;
  left: 0;
}

@keyframes m8e-text-caret {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .m8e-text-preview-box > i {
    animation: none;
  }
}

@media (max-width: 799px), (pointer: coarse) {
  .m8e-text-preview-box {
    top: 35%;
    left: 12%;
    min-width: min(310px, 72%);
    min-height: 76px;
    padding: 16px 18px;
    font-size: 26px;
  }
}
`.trim()}\n`,
  );
}
