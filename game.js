// ============================================
// WREN'S CLIMATE QUEST - Main Game Logic
// 3D Exploration Game with Decision-Making
// ============================================

// Model Asset Configuration
// Place all GLB files in /assets/ folder
const ASSET_PATHS = {
  // Character
  player: 'assets/wren.glb',                    // Main character model
  
  // Nature elements
  tree: 'assets/tree.glb',                      // Generic tree
  tree_variants: [                              // Optional: multiple tree types
    'assets/tree1.glb',
    'assets/tree2.glb',
    'assets/tree3.glb'
  ],
  
  // Location buildings
  backyard: 'assets/backyard.glb',              // House/yard model
  park: 'assets/park.glb',                      // Park structure
  street: 'assets/street.glb',                  // Street section
  building: 'assets/community_center.glb',      // Community center
  waterway: 'assets/creek.glb',                 // Creek/stream
  
  // Environment (optional)
  ground: 'assets/ground.glb',                  // Ground tile (if you have it)
  
  // Interaction markers
  marker: 'assets/marker.glb'                   // Optional: custom marker
};

// Model cache for loaded models
const MODEL_CACHE = new Map();
const LOADING_MANAGER = new THREE.LoadingManager();
let GLTF_LOADER = null;

// Global game state
const GameState = {
  scene: null,
  camera: null,
  renderer: null,
  player: null,
  playerModel: null,
  locations: [],
  currentSeason: 0,
  seasonTimer: 120, // 2 minutes per season
  temperature: 75,
  biodiversity: 50,
  community: 50,
  resources: 100,
  nearestLocation: null,
  completedLocations: new Set(),
  gameActive: false,
  keys: {},
  world: {
    size: 150,        // INCREASED from 50 to 150
    tileSize: 5,
    chunks: new Map()
  },
  modelsLoaded: false
};

// Season configuration
const SEASONS = [
  { name: 'Spring', icon: '🌱', tempModifier: 0, color: 0x90EE90 },
  { name: 'Summer', icon: '☀️', tempModifier: 5, color: 0xFFD700 },
  { name: 'Fall', icon: '🍂', tempModifier: 2, color: 0xFF8C00 },
  { name: 'Winter', icon: '❄️', tempModifier: -3, color: 0xADD8E6 }
];

// Location types with scenarios
const LOCATION_TYPES = [
  {
    type: 'backyard',
    icon: '🏡',
    color: 0x8B4513,
    name: 'Backyard',
    scenarios: [
      {
        title: 'Transform the Lawn',
        description: 'This backyard has a large grass lawn that requires constant watering and mowing. The homeowner is open to changes but worried about costs.',
        context: 'Current: 1000 sq ft of thirsty grass lawn, pesticide use, no habitat value',
        options: [
          {
            title: '🌸 Plant Native Pollinator Garden',
            description: 'Remove half the lawn and plant native wildflowers, grasses, and shrubs.',
            cost: 40,
            effects: { temp: -2, bio: +8, community: +5 },
            message: 'The native garden attracts dozens of pollinators! Neighbors are impressed and curious.',
            risks: 'Looks "messy" to some neighbors initially'
          },
          {
            title: '🍂 Leave the Leaf Litter',
            description: 'Stop raking leaves, let them decompose naturally to build soil and host insects.',
            cost: 0,
            effects: { temp: -1, bio: +4, community: -3 },
            message: 'Fungi and soil life flourish! But some neighbors complain about the "untidy" look.',
            risks: 'Negative initial community reaction'
          },
          {
            title: '🌳 Plant a Shade Tree',
            description: 'Plant one large native tree to cool the house and yard.',
            cost: 25,
            effects: { temp: -3, bio: +3, community: +2 },
            message: 'The tree will cool this house by 5-10°F when mature! Birds already love it.',
            risks: 'Takes years to reach full cooling potential'
          }
        ]
      },
      {
        title: 'The Pesticide Problem',
        description: 'The homeowner uses chemical pesticides to keep the lawn "perfect". You notice few insects and no birds visiting.',
        context: 'Monthly pesticide application killing beneficial insects',
        options: [
          {
            title: '🐝 Ban Pesticides',
            description: 'Convince them to stop all pesticides and accept some "imperfection".',
            cost: 0,
            effects: { temp: 0, bio: +10, community: -5 },
            message: 'Within weeks, bees and butterflies return! But lawn looks less "perfect".',
            risks: 'Community pushback from neat-lawn advocates'
          },
          {
            title: '🌱 Integrated Pest Management',
            description: 'Introduce beneficial insects and organic methods.',
            cost: 30,
            effects: { temp: -1, bio: +6, community: +3 },
            message: 'Ladybugs and lacewings control pests naturally. It works!',
            risks: 'Requires ongoing education and monitoring'
          },
          {
            title: '📚 Do Nothing, Educate Later',
            description: 'Skip this house, focus resources elsewhere.',
            cost: 0,
            effects: { temp: +1, bio: -2, community: 0 },
            message: 'You move on, but the pesticides continue killing beneficial insects.',
            risks: 'Missed opportunity'
          }
        ]
      }
    ]
  },
  {
    type: 'park',
    icon: '🌳',
    color: 0x228B22,
    name: 'Park',
    scenarios: [
      {
        title: 'Restore the Wetland',
        description: 'The old drainage ditch used to be a thriving wetland. Now it just channels water away quickly, causing flooding downstream.',
        context: 'Concrete ditch, no habitat, flooding problems, lost biodiversity',
        options: [
          {
            title: '💧 Full Wetland Restoration',
            description: 'Remove concrete, restore native wetland plants, let beavers return.',
            cost: 80,
            effects: { temp: -5, bio: +15, community: +8 },
            message: 'A wetland oasis forms! Herons arrive, flooding stops, and the area cools dramatically.',
            risks: 'Very expensive, some worry about mosquitoes'
          },
          {
            title: '🪴 Rain Garden Compromise',
            description: 'Create a smaller rain garden that captures some runoff.',
            cost: 35,
            effects: { temp: -2, bio: +6, community: +4 },
            message: 'The rain garden handles stormwater and looks beautiful!',
            risks: 'Less impactful than full restoration'
          },
          {
            title: '🚫 Keep the Ditch',
            description: 'Too expensive to change now.',
            cost: 0,
            effects: { temp: +2, bio: -3, community: -2 },
            message: 'Flooding continues, habitat remains lost.',
            risks: 'Ongoing problems persist'
          }
        ]
      },
      {
        title: 'The Tiny Forest Project',
        description: 'There\'s an empty lot in the park - perfect for a "pocket forest" with densely planted native trees.',
        context: 'Empty mowed lawn space, high heat island effect, unused',
        options: [
          {
            title: '🌲 Plant a Miyawaki Forest',
            description: 'Densely plant 300+ native trees to create a fast-growing mini-forest.',
            cost: 60,
            effects: { temp: -4, bio: +12, community: +10 },
            message: 'The dense forest grows 10x faster! Temperature drops 8°F in the area.',
            risks: 'High upfront cost, looks crowded'
          },
          {
            title: '🌳 Traditional Tree Planting',
            description: 'Plant spaced trees in a traditional layout.',
            cost: 30,
            effects: { temp: -2, bio: +5, community: +5 },
            message: 'Trees grow well but take longer to provide cooling.',
            risks: 'Slower impact'
          },
          {
            title: '⚽ Make a Sports Field',
            description: 'Community wants more play space.',
            cost: 20,
            effects: { temp: +3, bio: -5, community: +8 },
            message: 'Kids love it, but the grass needs constant water and provides no cooling.',
            risks: 'Increases heat and resource use'
          }
        ]
      }
    ]
  },
  {
    type: 'street',
    icon: '🛣️',
    color: 0x696969,
    name: 'Street',
    scenarios: [
      {
        title: 'Road Redesign Decision',
        description: 'This 4-lane road is rarely busy and creates a heat island. There\'s pressure to do something.',
        context: 'Hot asphalt, car-dependent, dangerous for bikes/pedestrians',
        options: [
          {
            title: '🚴 Add Protected Bike Lanes',
            description: 'Reduce to 2 car lanes, add protected bike lanes and street trees.',
            cost: 50,
            effects: { temp: -3, bio: +4, community: +6 },
            message: 'Bike traffic increases 300%! Trees cool the street. Some drivers complain.',
            risks: 'Drivers initially upset'
          },
          {
            title: '🌳 Green Street Transformation',
            description: 'Add bioswales, rain gardens, and shade trees along the street.',
            cost: 45,
            effects: { temp: -4, bio: +8, community: +3 },
            message: 'Stormwater is captured, trees provide shade. Beautiful and functional!',
            risks: 'Parking spaces reduced'
          },
          {
            title: '🅿️ Add More Parking',
            description: 'Local businesses want more parking spaces.',
            cost: 30,
            effects: { temp: +4, bio: -6, community: +4 },
            message: 'More parking built, but heat island effect worsens significantly.',
            risks: 'Makes climate problem worse'
          }
        ]
      },
      {
        title: 'The Bus Route Battle',
        description: 'The city wants to cut this bus route due to "low ridership". But removing it will force more car dependency.',
        context: 'Only transit option for some residents, cars cause pollution',
        options: [
          {
            title: '🚌 Fight to Save the Route',
            description: 'Organize community to show support and increase ridership.',
            cost: 20,
            effects: { temp: -2, bio: 0, community: +8 },
            message: 'Community rallies! Ridership doubles and the route is saved.',
            risks: 'Takes organizing effort'
          },
          {
            title: '🚗 Accept Car Dependency',
            description: 'Let the route be cut.',
            cost: 0,
            effects: { temp: +3, bio: -2, community: -4 },
            message: 'Transit access lost. More cars, more emissions, more isolation.',
            risks: 'Worsens climate and community'
          },
          {
            title: '🚴 Promote Bike Share',
            description: 'Add bike share stations as alternative.',
            cost: 35,
            effects: { temp: -1, bio: +1, community: +5 },
            message: 'Bikes help, but don\'t work for all trips. Partial solution.',
            risks: 'Doesn\'t help those unable to bike'
          }
        ]
      }
    ]
  },
  {
    type: 'building',
    icon: '🏪',
    color: 0xDC143C,
    name: 'Community Center',
    scenarios: [
      {
        title: 'Green Roof or Solar Panels?',
        description: 'The community center needs a new roof. You have two climate-friendly options, but only budget for one.',
        context: 'Old roof needs replacement, high energy costs, hot building',
        options: [
          {
            title: '🌱 Install Green Roof',
            description: 'Plant native grasses and flowers on the roof.',
            cost: 50,
            effects: { temp: -3, bio: +10, community: +5 },
            message: 'The green roof cools the building, supports pollinators, and handles stormwater!',
            risks: 'Requires maintenance'
          },
          {
            title: '☀️ Install Solar Panels',
            description: 'Add solar panels to generate clean energy.',
            cost: 45,
            effects: { temp: -1, bio: 0, community: +7 },
            message: 'Solar panels cut energy costs by 70%! A visible climate win.',
            risks: 'No habitat benefit'
          },
          {
            title: '🌳 Both! Plant Trees Instead',
            description: 'Skip roof investment, plant shade trees around building.',
            cost: 25,
            effects: { temp: -2, bio: +6, community: +3 },
            message: 'Trees cool the building and look great, but roof still needs replacing soon.',
            risks: 'Doesn\'t solve roof problem'
          }
        ]
      },
      {
        title: 'Community Garden Launch',
        description: 'Residents want to start a community garden, but there are different visions for what it should be.',
        context: 'Unused lawn space behind building, food desert neighborhood',
        options: [
          {
            title: '🌽 Food Production Focus',
            description: 'Maximize vegetables and fruits for the community.',
            cost: 40,
            effects: { temp: -1, bio: +3, community: +10 },
            message: 'Fresh food for 50 families! Strong community building.',
            risks: 'Less biodiversity than native garden'
          },
          {
            title: '🌸 Pollinator & Food Mix',
            description: 'Combine food crops with native pollinator habitat.',
            cost: 45,
            effects: { temp: -2, bio: +9, community: +7 },
            message: 'Food AND habitat! Bees improve crop yields.',
            risks: 'More complex to manage'
          },
          {
            title: '👥 Community Decision Process',
            description: 'Take more time to get everyone\'s input first.',
            cost: 10,
            effects: { temp: 0, bio: 0, community: +6 },
            message: 'Stronger buy-in, but delays the project by a season.',
            risks: 'Delay in climate action'
          }
        ]
      }
    ]
  },
  {
    type: 'waterway',
    icon: '💧',
    color: 0x4169E1,
    name: 'Creek',
    scenarios: [
      {
        title: 'Let the Beavers Return?',
        description: 'Beavers want to build a dam here, but some worry about flooding. Beavers are nature\'s water engineers.',
        context: 'Creek flows too fast, no wetlands, downstream flooding',
        options: [
          {
            title: '🦫 Welcome the Beavers',
            description: 'Let them build and restore the ecosystem.',
            cost: 0,
            effects: { temp: -4, bio: +15, community: -3 },
            message: 'Beaver ponds create wetlands! Water is stored, biodiversity explodes. Some complaints.',
            risks: 'Some flooding concerns, tree loss'
          },
          {
            title: '🏗️ Install Flow Devices',
            description: 'Let beavers stay but manage water levels with flow devices.',
            cost: 40,
            effects: { temp: -3, bio: +12, community: +4 },
            message: 'Best of both! Beavers thrive, flooding controlled.',
            risks: 'Requires ongoing management'
          },
          {
            title: '🚫 Remove the Beavers',
            description: 'Trap and relocate them.',
            cost: 20,
            effects: { temp: +2, bio: -8, community: +2 },
            message: 'Creek returns to rushing water. Habitat is lost. Problem not solved.',
            risks: 'Loses major ecosystem restoration opportunity'
          }
        ]
      },
      {
        title: 'Concrete vs. Nature',
        description: 'The creek floods sometimes. Engineers want to line it with concrete. Environmentalists say restore natural floodplain instead.',
        context: 'Natural creek, occasional flooding, habitat present',
        options: [
          {
            title: '🌊 Restore Natural Floodplain',
            description: 'Remove human structures from floodplain, let nature work.',
            cost: 30,
            effects: { temp: -3, bio: +10, community: +3 },
            message: 'Creek spreads out naturally during storms. No flooding downstream!',
            risks: 'Some property needs to move'
          },
          {
            title: '🏗️ Concrete Channel',
            description: 'Line creek with concrete for "flood control".',
            cost: 50,
            effects: { temp: +4, bio: -12, community: +4 },
            message: 'Water moves faster... creating worse flooding downstream. Habitat destroyed.',
            risks: 'Makes problem worse long-term'
          },
          {
            title: '🌳 Hybrid Approach',
            description: 'Some natural restoration, some engineered solutions.',
            cost: 45,
            effects: { temp: -1, bio: +5, community: +6 },
            message: 'Compromise works okay, but not as good as full restoration.',
            risks: 'Not optimal for nature or engineering'
          }
        ]
      }
    ]
  }
];

// ============================================
// MODEL LOADING SYSTEM
// ============================================

// Initialize GLTF Loader
function initModelLoader() {
  GLTF_LOADER = new THREE.GLTFLoader(LOADING_MANAGER);
  
  // Setup loading manager callbacks
  LOADING_MANAGER.onStart = (url, loaded, total) => {
    console.log(`Loading models: ${loaded}/${total}`);
  };
  
  LOADING_MANAGER.onLoad = () => {
    console.log('All models loaded!');
    GameState.modelsLoaded = true;
    updateLoadingText('Models loaded! Starting game...');
  };
  
  LOADING_MANAGER.onProgress = (url, loaded, total) => {
    const progress = Math.round((loaded / total) * 100);
    updateLoadingText(`Loading models... ${progress}%`);
  };
  
  LOADING_MANAGER.onError = (url) => {
    console.error(`Error loading: ${url}`);
    // Fallback to geometric shapes if model fails
  };
}

// Update loading screen text
function updateLoadingText(text) {
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = text;
  }
}

// Load a single model and cache it
async function loadModel(path, scale = 1) {
  // Check cache first
  if (MODEL_CACHE.has(path)) {
    return MODEL_CACHE.get(path).clone();
  }
  
  return new Promise((resolve, reject) => {
    GLTF_LOADER.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(scale, scale, scale);
        
        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        // Cache the model
        MODEL_CACHE.set(path, model);
        resolve(model.clone());
      },
      (progress) => {
        // Loading progress
      },
      (error) => {
        console.error(`Failed to load model: ${path}`, error);
        // Return fallback geometry
        resolve(createFallbackGeometry(path));
      }
    );
  });
}

// Create fallback geometry if model fails to load
function createFallbackGeometry(path) {
  const group = new THREE.Group();
  
  if (path.includes('wren') || path.includes('player')) {
    // Fallback player
    const geometry = new THREE.ConeGeometry(0.5, 2, 8);
    const material = new THREE.MeshLambertMaterial({ color: 0xffa500 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
  } else if (path.includes('tree')) {
    // Fallback tree
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 3, 8),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x228B22 })
    );
    foliage.position.y = 3;
    foliage.castShadow = true;
    
    group.add(trunk, foliage);
  } else {
    // Generic fallback building
    const color = path.includes('backyard') ? 0x8B4513 :
                  path.includes('park') ? 0x228B22 :
                  path.includes('street') ? 0x696969 :
                  path.includes('building') ? 0xDC143C :
                  path.includes('creek') ? 0x4169E1 : 0x888888;
    
    const geometry = new THREE.BoxGeometry(3, 3, 3);
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 1.5;
    mesh.castShadow = true;
    group.add(mesh);
  }
  
  return group;
}

// Preload all essential models
async function preloadModels() {
  const essentialModels = [
    ASSET_PATHS.player,
    ASSET_PATHS.tree,
    ASSET_PATHS.backyard,
    ASSET_PATHS.park,
    ASSET_PATHS.street,
    ASSET_PATHS.building,
    ASSET_PATHS.waterway
  ];
  
  try {
    const loadPromises = essentialModels.map(path => loadModel(path));
    await Promise.all(loadPromises);
    console.log('All essential models preloaded');
  } catch (error) {
    console.error('Error preloading models:', error);
  }
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('load', () => {
  initModelLoader();
  setTimeout(async () => {
    document.getElementById('loadingScreen').classList.remove('active');
    document.getElementById('storyScreen').classList.add('active');
  }, 1000);
  
  // Preload models in background
  preloadModels();
});

function showInstructions() {
  document.getElementById('storyScreen').classList.remove('active');
  document.getElementById('instructionsScreen').classList.add('active');
}

async function startGame() {
  // Make sure models are loaded
  if (!GameState.modelsLoaded) {
    updateLoadingText('Still loading models, please wait...');
    document.getElementById('instructionsScreen').classList.remove('active');
    document.getElementById('loadingScreen').classList.add('active');
    
    // Wait for models to load
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (GameState.modelsLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    document.getElementById('loadingScreen').classList.remove('active');
  } else {
    document.getElementById('instructionsScreen').classList.remove('active');
  }
  
  document.getElementById('gameUI').classList.remove('hidden');
  
  await initThreeJS();
  await generateWorld();
  startGameLoop();
  startSeasonTimer();
  GameState.gameActive = true;
}

// ============================================
// THREE.JS SETUP
// ============================================

function initThreeJS() {
  const canvas = document.getElementById('gameCanvas');
  
  // Scene
  GameState.scene = new THREE.Scene();
  GameState.scene.background = new THREE.Color(0x87CEEB);
  GameState.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
  
  // Camera (isometric-style)
  GameState.camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  GameState.camera.position.set(20, 25, 20);
  GameState.camera.lookAt(0, 0, 0);
  
  // Renderer
  GameState.renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true 
  });
  GameState.renderer.setSize(window.innerWidth, window.innerHeight);
  GameState.renderer.shadowMap.enabled = true;
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  GameState.scene.add(ambientLight);
  
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  sunLight.position.set(50, 50, 50);
  sunLight.castShadow = true;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  GameState.scene.add(sunLight);
  
  // Create player (Wren)
  createPlayer();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    GameState.camera.aspect = window.innerWidth / window.innerHeight;
    GameState.camera.updateProjectionMatrix();
    GameState.renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    GameState.keys[e.key.toLowerCase()] = true;
    
    if (e.key === ' ' && GameState.nearestLocation && !GameState.nearestLocation.completed) {
      e.preventDefault();
      interactWithLocation(GameState.nearestLocation);
    }
  });
  
  window.addEventListener('keyup', (e) => {
    GameState.keys[e.key.toLowerCase()] = false;
  });
}

async function createPlayer() {
  // Load player model
  const playerModel = await loadModel(ASSET_PATHS.player, 1.5);
  
  // Create container for player
  GameState.player = new THREE.Group();
  GameState.player.add(playerModel);
  GameState.player.position.set(0, 0, 0);
  GameState.playerModel = playerModel;
  
  GameState.scene.add(GameState.player);
  
  console.log('Player model loaded');
}

// ============================================
// WORLD GENERATION
// ============================================

async function generateWorld() {
  // Ground - much larger now
  const groundSize = 400; // INCREASED from 200 to 400
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x7cb342,
    side: THREE.DoubleSide 
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  GameState.scene.add(ground);
  
  // Generate locations around the world
  await generateLocations();
  
  // Add decorative trees
  await addDecorationTrees();
  
  console.log('World generation complete');
}

async function generateLocations() {
  // Spread locations across larger map (within -80 to +80 range)
  const positions = [
    { x: 20, z: 20 },
    { x: -30, z: 25 },
    { x: 40, z: -25 },
    { x: -25, z: -35 },
    { x: 50, z: 0 },
    { x: 0, z: 45 },
    { x: -40, z: -15 },
    { x: 25, z: -50 },
    { x: -50, z: 30 },
    { x: 35, z: 40 },
    { x: -15, z: -45 },
    { x: 60, z: -15 }
  ];
  
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const locationType = LOCATION_TYPES[i % LOCATION_TYPES.length];
    await createLocation(pos.x, pos.z, locationType);
  }
}

async function createLocation(x, z, type) {
  // Determine which model to load based on type
  let modelPath;
  switch (type.type) {
    case 'backyard':
      modelPath = ASSET_PATHS.backyard;
      break;
    case 'park':
      modelPath = ASSET_PATHS.park;
      break;
    case 'street':
      modelPath = ASSET_PATHS.street;
      break;
    case 'building':
      modelPath = ASSET_PATHS.building;
      break;
    case 'waterway':
      modelPath = ASSET_PATHS.waterway;
      break;
    default:
      modelPath = ASSET_PATHS.backyard;
  }
  
  // Load the building model
  const building = await loadModel(modelPath, 1.0);
  building.position.set(x, 0, z);
  GameState.scene.add(building);
  
  // Add a marker above it (using simple geometry or custom marker model)
  let marker;
  if (ASSET_PATHS.marker && MODEL_CACHE.has(ASSET_PATHS.marker)) {
    marker = await loadModel(ASSET_PATHS.marker, 0.5);
  } else {
    // Fallback marker
    const markerGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
    const markerMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
  }
  marker.position.set(x, 5, z);
  GameState.scene.add(marker);
  
  // Store location data
  const location = {
    position: { x, z },
    type: type.type,
    name: type.name,
    icon: type.icon,
    scenarios: type.scenarios,
    mesh: building,
    marker: marker,
    completed: false,
    currentScenario: 0
  };
  
  GameState.locations.push(location);
}

async function addDecorationTrees() {
  const numTrees = 80; // More trees for bigger map
  
  for (let i = 0; i < numTrees; i++) {
    const x = (Math.random() - 0.5) * 180; // Spread across larger area
    const z = (Math.random() - 0.5) * 180;
    
    // Avoid placing on locations
    const tooClose = GameState.locations.some(loc => {
      const dx = loc.position.x - x;
      const dz = loc.position.z - z;
      return Math.sqrt(dx * dx + dz * dz) < 12;
    });
    
    if (!tooClose) {
      await createTree(x, z);
    }
  }
}

async function createTree(x, z) {
  // Choose random tree variant if available
  let treePath = ASSET_PATHS.tree;
  if (ASSET_PATHS.tree_variants && ASSET_PATHS.tree_variants.length > 0) {
    const randomIndex = Math.floor(Math.random() * ASSET_PATHS.tree_variants.length);
    treePath = ASSET_PATHS.tree_variants[randomIndex];
  }
  
  // Load tree model
  const tree = await loadModel(treePath, 1.0 + Math.random() * 0.5); // Random scale variation
  tree.position.set(x, 0, z);
  
  // Random rotation for variety
  tree.rotation.y = Math.random() * Math.PI * 2;
  
  GameState.scene.add(tree);
}

// ============================================
// GAME LOOP
// ============================================

function startGameLoop() {
  function animate() {
    if (GameState.gameActive) {
      updatePlayer();
      updateCamera();
      updateNearestLocation();
      updateMiniMap();
      GameState.renderer.render(GameState.scene, GameState.camera);
    }
    requestAnimationFrame(animate);
  }
  animate();
}

function updatePlayer() {
  const speed = 0.15;
  const moveVector = new THREE.Vector3();
  
  if (GameState.keys['w']) moveVector.z -= speed;
  if (GameState.keys['s']) moveVector.z += speed;
  if (GameState.keys['a']) moveVector.x -= speed;
  if (GameState.keys['d']) moveVector.x += speed;
  
  if (moveVector.length() > 0) {
    moveVector.normalize().multiplyScalar(speed);
    GameState.player.position.add(moveVector);
    
    // Rotate player to face movement direction
    if (moveVector.x !== 0 || moveVector.z !== 0) {
      GameState.player.rotation.y = Math.atan2(moveVector.x, moveVector.z);
    }
  }
  
  // Clamp position to world bounds (increased for larger map)
  const bound = 90; // INCREASED from 40 to 90
  GameState.player.position.x = Math.max(-bound, Math.min(bound, GameState.player.position.x));
  GameState.player.position.z = Math.max(-bound, Math.min(bound, GameState.player.position.z));
}

function updateCamera() {
  // Camera follows player
  const offset = new THREE.Vector3(15, 20, 15);
  const targetPos = GameState.player.position.clone().add(offset);
  GameState.camera.position.lerp(targetPos, 0.05);
  GameState.camera.lookAt(GameState.player.position);
}

function updateNearestLocation() {
  let nearest = null;
  let minDist = Infinity;
  
  GameState.locations.forEach(loc => {
    if (!loc.completed) {
      const dx = loc.position.x - GameState.player.position.x;
      const dz = loc.position.z - GameState.player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < minDist && dist < 5) {
        minDist = dist;
        nearest = loc;
      }
    }
  });
  
  GameState.nearestLocation = nearest;
  
  // Show/hide interaction prompt
  const prompt = document.getElementById('interactionPrompt');
  if (nearest) {
    prompt.classList.remove('hidden');
    prompt.querySelector('.prompt-text').textContent = `Press SPACE to visit ${nearest.name}`;
  } else {
    prompt.classList.add('hidden');
  }
}

function updateMiniMap() {
  const canvas = document.getElementById('miniMapCanvas');
  const ctx = canvas.getContext('2d');
  const scale = 1.1; // ADJUSTED from 2 to 1.1 for larger world
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Background
  ctx.fillStyle = '#7cb342';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Locations
  GameState.locations.forEach(loc => {
    ctx.fillStyle = loc.completed ? '#666666' : '#ff0000';
    ctx.beginPath();
    ctx.arc(
      100 + loc.position.x * scale,
      100 + loc.position.z * scale,
      4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });
  
  // Player
  ctx.fillStyle = '#ffa500';
  ctx.beginPath();
  ctx.arc(
    100 + GameState.player.position.x * scale,
    100 + GameState.player.position.z * scale,
    6,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

// ============================================
// LOCATION INTERACTION
// ============================================

function interactWithLocation(location) {
  GameState.gameActive = false;
  
  const scenario = location.scenarios[location.currentScenario];
  
  document.getElementById('decisionTitle').textContent = `${location.icon} ${scenario.title}`;
  document.getElementById('locationIcon').textContent = location.icon;
  document.getElementById('decisionDescription').textContent = scenario.description;
  document.getElementById('decisionContext').textContent = `Context: ${scenario.context}`;
  
  const optionsContainer = document.getElementById('decisionOptions');
  optionsContainer.innerHTML = '';
  
  scenario.options.forEach((option, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'decision-option';
    optionDiv.onclick = () => selectOption(location, scenario, option);
    
    optionDiv.innerHTML = `
      <h3>${option.title}</h3>
      <p>${option.description}</p>
      <div class="decision-costs">
        <span class="cost-item"><strong>💰 Cost:</strong> ${option.cost}</span>
        <span class="cost-item ${option.effects.temp < 0 ? 'cost-positive' : 'cost-negative'}">
          🌡️ ${option.effects.temp > 0 ? '+' : ''}${option.effects.temp}°F
        </span>
        <span class="cost-item ${option.effects.bio > 0 ? 'cost-positive' : 'cost-negative'}">
          🦋 ${option.effects.bio > 0 ? '+' : ''}${option.effects.bio}%
        </span>
        <span class="cost-item ${option.effects.community > 0 ? 'cost-positive' : 'cost-negative'}">
          👥 ${option.effects.community > 0 ? '+' : ''}${option.effects.community}%
        </span>
      </div>
      ${option.risks ? `<p style="color: #ff6b6b; margin-top: 10px;"><strong>⚠️ Risk:</strong> ${option.risks}</p>` : ''}
    `;
    
    optionsContainer.appendChild(optionDiv);
  });
  
  document.getElementById('decisionModal').classList.remove('hidden');
}

function selectOption(location, scenario, option) {
  // Check if player has enough resources
  if (GameState.resources < option.cost) {
    alert('Not enough resources for this option!');
    return;
  }
  
  // Apply effects
  GameState.resources -= option.cost;
  GameState.temperature += option.effects.temp;
  GameState.biodiversity += option.effects.bio;
  GameState.community += option.effects.community;
  
  // Clamp values
  GameState.temperature = Math.max(65, Math.min(100, GameState.temperature));
  GameState.biodiversity = Math.max(0, Math.min(100, GameState.biodiversity));
  GameState.community = Math.max(0, Math.min(100, GameState.community));
  GameState.resources = Math.max(0, Math.min(150, GameState.resources));
  
  updateUI();
  
  // Close decision modal
  document.getElementById('decisionModal').classList.add('hidden');
  
  // Show result modal
  showResult(location, option);
  
  // Mark location as completed for this scenario
  location.currentScenario++;
  if (location.currentScenario >= location.scenarios.length) {
    location.completed = true;
    location.mesh.material.color.setHex(0x666666);
    location.marker.visible = false;
  }
  
  // Check win/lose conditions
  checkGameStatus();
}

function showResult(location, option) {
  document.getElementById('resultDescription').textContent = option.message;
  
  const effectsContainer = document.getElementById('resultEffects');
  effectsContainer.innerHTML = `
    <div class="effect-item">
      <span class="effect-icon">💰</span>
      <div class="effect-info">
        <div class="effect-label">Resources Used</div>
        <div class="effect-value negative">-${option.cost}</div>
      </div>
    </div>
    <div class="effect-item">
      <span class="effect-icon">🌡️</span>
      <div class="effect-info">
        <div class="effect-label">Temperature</div>
        <div class="effect-value ${option.effects.temp < 0 ? 'positive' : 'negative'}">
          ${option.effects.temp > 0 ? '+' : ''}${option.effects.temp}°F
        </div>
      </div>
    </div>
    <div class="effect-item">
      <span class="effect-icon">🦋</span>
      <div class="effect-info">
        <div class="effect-label">Biodiversity</div>
        <div class="effect-value ${option.effects.bio > 0 ? 'positive' : 'negative'}">
          ${option.effects.bio > 0 ? '+' : ''}${option.effects.bio}%
        </div>
      </div>
    </div>
    <div class="effect-item">
      <span class="effect-icon">👥</span>
      <div class="effect-info">
        <div class="effect-label">Community</div>
        <div class="effect-value ${option.effects.community > 0 ? 'positive' : 'negative'}">
          ${option.effects.community > 0 ? '+' : ''}${option.effects.community}%
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('resultModal').classList.remove('hidden');
}

function closeResultModal() {
  document.getElementById('resultModal').classList.add('hidden');
  GameState.gameActive = true;
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
  // Temperature
  document.getElementById('tempValue').textContent = `${Math.round(GameState.temperature)}°F`;
  document.getElementById('tempBar').style.width = `${(GameState.temperature - 65) / (100 - 65) * 100}%`;
  
  // Biodiversity
  document.getElementById('bioValue').textContent = `${Math.round(GameState.biodiversity)}%`;
  document.getElementById('bioBar').style.width = `${GameState.biodiversity}%`;
  
  // Community
  document.getElementById('communityValue').textContent = `${Math.round(GameState.community)}%`;
  document.getElementById('communityBar').style.width = `${GameState.community}%`;
  
  // Resources
  document.getElementById('resourceValue').textContent = Math.round(GameState.resources);
  document.getElementById('resourceBar').style.width = `${(GameState.resources / 150) * 100}%`;
}

// ============================================
// SEASON SYSTEM
// ============================================

function startSeasonTimer() {
  setInterval(() => {
    if (GameState.gameActive) {
      GameState.seasonTimer--;
      
      const minutes = Math.floor(GameState.seasonTimer / 60);
      const seconds = GameState.seasonTimer % 60;
      document.getElementById('seasonTimer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (GameState.seasonTimer <= 0) {
        advanceSeason();
      }
    }
  }, 1000);
}

function advanceSeason() {
  GameState.currentSeason++;
  
  if (GameState.currentSeason >= 4) {
    // Completed all 4 seasons!
    winGame();
    return;
  }
  
  const season = SEASONS[GameState.currentSeason];
  GameState.seasonTimer = 120;
  GameState.temperature += season.tempModifier;
  GameState.resources += 30; // Resource replenishment each season
  
  updateUI();
  updateSeasonDisplay();
  checkGameStatus();
  
  // Show season change notification
  showSeasonChange(season);
}

function updateSeasonDisplay() {
  const season = SEASONS[GameState.currentSeason];
  document.getElementById('seasonIcon').textContent = season.icon;
  document.getElementById('seasonLabel').textContent = season.name;
  
  // Update scene colors
  GameState.scene.background = new THREE.Color(season.color);
  GameState.scene.fog.color = new THREE.Color(season.color);
}

function showSeasonChange(season) {
  alert(`🌍 ${season.name} has arrived!\n\nTemperature ${season.tempModifier > 0 ? 'increases' : 'decreases'} by ${Math.abs(season.tempModifier)}°F\n+30 Resources replenished`);
}

// ============================================
// WIN/LOSE CONDITIONS
// ============================================

function checkGameStatus() {
  if (GameState.temperature >= 85) {
    loseGame('Temperature too high! The neighborhood overheated.');
  } else if (GameState.biodiversity < 30) {
    loseGame('Biodiversity collapsed! The ecosystem can\'t recover.');
  } else if (GameState.community < 40) {
    loseGame('Community support lost! People gave up on climate action.');
  }
}

function loseGame(reason) {
  GameState.gameActive = false;
  
  document.getElementById('gameOverIcon').textContent = '🌡️😰';
  document.getElementById('gameOverTitle').textContent = 'Climate Challenge Failed';
  document.getElementById('gameOverMessage').textContent = reason;
  
  document.getElementById('finalStats').innerHTML = `
    <div class="final-stat">
      <div class="final-stat-label">Final Temperature</div>
      <div class="final-stat-value">${Math.round(GameState.temperature)}°F</div>
    </div>
    <div class="final-stat">
      <div class="final-stat-label">Biodiversity</div>
      <div class="final-stat-value">${Math.round(GameState.biodiversity)}%</div>
    </div>
    <div class="final-stat">
      <div class="final-stat-label">Community Support</div>
      <div class="final-stat-value">${Math.round(GameState.community)}%</div>
    </div>
    <div class="final-stat">
      <div class="final-stat-label">Seasons Survived</div>
      <div class="final-stat-value">${GameState.currentSeason}</div>
    </div>
  `;
  
  document.getElementById('gameUI').classList.add('hidden');
  document.getElementById('gameOverScreen').classList.add('active');
}

function winGame() {
  GameState.gameActive = false;
  
  // Calculate achievements
  const achievements = [];
  if (GameState.temperature < 75) achievements.push('❄️ Cool Master: Kept temperature below 75°F');
  if (GameState.biodiversity > 70) achievements.push('🦋 Biodiversity Champion: Achieved 70%+ biodiversity');
  if (GameState.community > 70) achievements.push('👥 Community Hero: Maintained 70%+ support');
  if (GameState.resources > 80) achievements.push('💰 Resource Manager: Ended with 80+ resources');
  
  const completedCount = GameState.locations.filter(l => l.completed).length;
  if (completedCount === GameState.locations.length) {
    achievements.push('🌍 Neighborhood Transformer: Helped every location!');
  }
  
  document.getElementById('achievementsList').innerHTML = achievements.map(a => 
    `<div class="achievement-item">${a}</div>`
  ).join('');
  
  document.getElementById('winStats').innerHTML = `
    <div class="final-stat">
      <div class="final-stat-label">Final Temperature</div>
      <div class="final-stat-value" style="color: #4ade80">${Math.round(GameState.temperature)}°F</div>
    </div>
    <div class="final-stat">
      <div class="final-stat-label">Biodiversity</div>
      <div class="final-stat-value" style="color: #4ade80">${Math.round(GameState.biodiversity)}%</div>
    </div>
    <div class="final-stat">
      <div class="final-stat-label">Community Support</div>
      <div class="final-stat-value" style="color: #4ade80">${Math.round(GameState.community)}%</div>
    </div>
    <div class="final-stat">
      <div class="final-stat-label">Locations Helped</div>
      <div class="final-stat-value" style="color: #4ade80">${completedCount}/${GameState.locations.length}</div>
    </div>
  `;
  
  document.getElementById('gameUI').classList.add('hidden');
  document.getElementById('winScreen').classList.add('active');
}

function restartGame() {
  location.reload();
}

// Initialize UI
window.addEventListener('load', () => {
  updateUI();
});
