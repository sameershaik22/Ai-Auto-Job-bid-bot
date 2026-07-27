

let _io = null;

export function setIO(ioInstance) {
  _io = ioInstance;
}

export function getIO() {
  return _io;
}
