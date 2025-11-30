import * as THREE from 'three';

// Polyfill for removeFromParent method (used by older threejs-dice library)
// This must be executed before importing threejs-dice
if (THREE.Object3D.prototype.removeFromParent === undefined) {
  THREE.Object3D.prototype.removeFromParent = function() {
    if (this.parent !== null) {
      this.parent.remove(this);
    }
  };
}

