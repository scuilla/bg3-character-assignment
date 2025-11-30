import "../utils/threejs-polyfill";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as CANNON from "cannon";
import { DiceManager, DiceD8, DiceD10, DiceD12, DiceD20 } from "threejs-dice";

type DiceType = "d8" | "d10" | "d12" | "d20";
type DiceInstance = DiceD8 | DiceD10 | DiceD12 | DiceD20;

const DiceVisualizer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const diceRef = useRef<DiceInstance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRollingRef = useRef<boolean>(false);
  const sceneReadyRef = useRef<boolean>(false);

  const [diceType, setDiceType] = useState<DiceType>("d20");
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, 600 / 400, 0.1, 1000);
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(600, 400);
    renderer.setClearColor(0x222222, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    // Add a second light for better visibility
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(30, 30);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Initialize Cannon.js physics world
    const world = new CANNON.World();
    world.gravity.set(0, -9.82 * 20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 16;
    worldRef.current = world;

    DiceManager.setWorld(world);

    // Physics floor
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: DiceManager.floorBodyMaterial,
    });
    floorBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      -Math.PI / 2
    );
    floorBody.position.set(0, 0, 0);
    world.addBody(floorBody);
    // Mark scene as ready
    world.sceneReadyRef.current = true;

    // Animation loop
    const animate = () => {
      if (worldRef.current && diceRef.current) {
        worldRef.current.step(1 / 60);
        diceRef.current.updateMeshFromBody();

        // Check if dice has stopped rolling
        if (diceRef.current.isFinished() && isRollingRef.current) {
          const result = diceRef.current.getUpsideValue();
          setRollResult(result);
          setIsRolling(false);
          isRollingRef.current = false;
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (diceRef.current && sceneRef.current && worldRef.current) {
        const diceObject = diceRef.current.getObject();
        if (diceObject.parent) {
          sceneRef.current.remove(diceObject);
        }
        if (
          diceObject.body &&
          worldRef.current.bodies.indexOf(diceObject.body) !== -1
        ) {
          worldRef.current.remove(diceObject.body);
        }
      }
      if (
        rendererRef.current &&
        containerRef.current &&
        containerRef.current.contains(rendererRef.current.domElement)
      ) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Create dice when type changes
  useEffect(() => {
    if (!sceneRef.current || !worldRef.current || !sceneReadyRef.current)
      return;

    // Remove old dice
    // if (diceRef.current) {
    //   try {
    //     const diceObject = diceRef.current.getObject();
    //     if (sceneRef.current && diceObject.parent === sceneRef.current) {
    //       sceneRef.current.remove(diceObject);
    //     }
    //     if (worldRef.current && diceObject.body) {
    //       const bodyIndex = worldRef.current.bodies.indexOf(diceObject.body);
    //       if (bodyIndex !== -1) {
    //         worldRef.current.remove(diceObject.body);
    //       }
    //     }
    //   } catch (error) {
    //     console.warn("Error removing old dice:", error);
    //   }
    // }

    // Create new dice based on type
    const diceOptions = {
      size: 2.0,
      fontColor: "#000000",
      backColor: "#ff0000",
    };

    let newDice: DiceInstance;
    switch (diceType) {
      case "d8":
        newDice = new DiceD8(diceOptions);
        break;
      case "d10":
        newDice = new DiceD10(diceOptions);
        break;
      case "d12":
        newDice = new DiceD12(diceOptions);
        break;
      case "d20":
        newDice = new DiceD20(diceOptions);
        break;
    }

    // Position dice
    const diceObject = newDice.getObject();
    diceObject.position.set(0, 4, 0);
    diceObject.castShadow = true;
    diceObject.receiveShadow = true;

    // Make dice body kinematic initially so it doesn't fall until we roll
    newDice.updateBodyFromMesh();
    if (diceObject.body) {
      diceObject.body.type = CANNON.Body.KINEMATIC;
      diceObject.body.position.set(0, 4, 0);
    }

    try {
      if (!diceObject.parent && sceneRef.current) {
        sceneRef.current.add(diceObject);
      }
      if (diceObject.body && worldRef.current) {
        const bodyIndex = worldRef.current.bodies.indexOf(diceObject.body);
        if (bodyIndex === -1) {
          worldRef.current.add(diceObject.body);
        }
      }
      // Force a render to ensure dice is visible
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    } catch (error) {
      console.error("Error adding dice to scene:", error);
    }

    diceRef.current = newDice;
    setRollResult(null);
    setIsRolling(false);
    isRollingRef.current = false;
  }, [diceType]);

  const rollDice = () => {
    if (!diceRef.current || isRollingRef.current) return;

    setIsRolling(true);
    isRollingRef.current = true;
    setRollResult(null);

    // Reset position and make dynamic
    const diceObject = diceRef.current.getObject();
    diceObject.position.set(0, 4, 0);
    diceObject.quaternion.setFromEuler(
      new THREE.Euler(
        (Math.random() * 90 - 45) * (Math.PI / 180),
        (Math.random() * 90 - 45) * (Math.PI / 180),
        (Math.random() * 90 - 45) * (Math.PI / 180)
      )
    );
    diceRef.current.updateBodyFromMesh();

    // Change body type to dynamic so it can fall
    if (diceObject.body) {
      diceObject.body.type = CANNON.Body.DYNAMIC;
      diceRef.current.updateBodyFromMesh();
    }

    // Apply random forces
    const randX = Math.random() * 10 - 5;
    const randY = Math.random() * 10 + 20;
    const randZ = Math.random() * 10 - 5;
    if (diceObject.body) {
      diceObject.body.velocity.set(randX, randY, randZ);
      diceObject.body.angularVelocity.set(
        20 * Math.random() - 10,
        20 * Math.random() - 10,
        20 * Math.random() - 10
      );
    }
  };

  return (
    <div className="dice-visualizer">
      <div className="dice-container" ref={containerRef}></div>
      <div className="dice-controls">
        <div className="dice-type-selector">
          <button
            className={diceType === "d8" ? "active" : ""}
            onClick={() => setDiceType("d8")}
            disabled={isRolling}
          >
            d8
          </button>
          <button
            className={diceType === "d10" ? "active" : ""}
            onClick={() => setDiceType("d10")}
            disabled={isRolling}
          >
            d10
          </button>
          <button
            className={diceType === "d12" ? "active" : ""}
            onClick={() => setDiceType("d12")}
            disabled={isRolling}
          >
            d12
          </button>
          <button
            className={diceType === "d20" ? "active" : ""}
            onClick={() => setDiceType("d20")}
            disabled={isRolling}
          >
            d20
          </button>
        </div>
        <button className="roll-button" onClick={rollDice} disabled={isRolling}>
          {isRolling ? "Rolling..." : "Roll Dice"}
        </button>
      </div>
      {rollResult !== null && (
        <div className="result-display">
          <h2>Result: {rollResult}</h2>
        </div>
      )}
    </div>
  );
};

export default DiceVisualizer;
