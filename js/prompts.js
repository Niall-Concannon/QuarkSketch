// QuarkSketch prompt pools
// 200 subjects and 200 actions for high round-to-round variety.
(function initPrompts(global) {
  const subjects = [
    "astronaut",
    "alien",
    "robot",
    "pirate",
    "ninja",
    "wizard",
    "knight",
    "dragon",
    "unicorn",
    "mermaid",
    "vampire",
    "werewolf",
    "ghost",
    "zombie",
    "detective",
    "chef",
    "doctor",
    "scientist",
    "teacher",
    "pilot",
    "firefighter",
    "lifeguard",
    "beekeeper",
    "farmer",
    "musician",
    "dancer",
    "gamer",
    "streamer",
    "inventor",
    "explorer",
    "penguin",
    "otter",
    "fox",
    "wolf",
    "bear",
    "tiger",
    "lion",
    "elephant",
    "giraffe",
    "koala",
    "kangaroo",
    "sloth",
    "owl",
    "eagle",
    "flamingo",
    "peacock",
    "parrot",
    "duck",
    "goose",
    "swan",
    "shark",
    "dolphin",
    "whale",
    "octopus",
    "jellyfish",
    "starfish",
    "crab",
    "lobster",
    "seahorse",
    "pufferfish",
    "chameleon",
    "iguana",
    "crocodile",
    "alligator",
    "frog",
    "toad",
    "snail",
    "butterfly",
    "dragonfly",
    "ladybug",
    "bumblebee",
    "ant",
    "spider",
    "raccoon",
    "hedgehog",
    "hamster",
    "guinea pig",
    "rabbit",
    "deer",
    "moose",
    "boar",
    "yak",
    "alpaca",
    "llama",
    "camel",
    "reindeer",
    "polar bear",
    "snowman",
    "gingerbread man",
    "toy soldier",
    "marionette",
    "clown",
    "juggler",
    "magician",
    "acrobat",
    "surfer",
    "skater",
    "cyclist",
    "hiker",
    "archer",
    "samurai",
    "cowboy",
    "cowgirl",
    "space cat",
    "space dog",
    "cat",
    "dog",
    "hamster astronaut",
    "time traveler",
    "superhero",
    "villain",
    "princess",
    "prince",
    "queen",
    "king",
    "court jester",
    "blacksmith",
    "carpenter",
    "potter",
    "tailor",
    "baker",
    "barista",
    "mail carrier",
    "librarian",
    "engineer",
    "mechanic",
    "plumber",
    "electrician",
    "gardener",
    "florist",
    "photographer",
    "filmmaker",
    "news reporter",
    "archaeologist",
    "paleontologist",
    "astronomer",
    "meteorologist",
    "race car driver",
    "train conductor",
    "bus driver",
    "taxi driver",
    "delivery rider",
    "mountain goat",
    "squirrel",
    "chipmunk",
    "ferret",
    "badger",
    "mole",
    "beaver",
    "seal",
    "walrus",
    "narwhal",
    "manta ray",
    "squid",
    "orca",
    "rhino",
    "hippo",
    "zebra",
    "buffalo",
    "cheetah",
    "panther",
    "leopard",
    "hyena",
    "meerkat",
    "lemur",
    "gorilla",
    "chimpanzee",
    "orangutan",
    "panda",
    "red panda",
    "toucan",
    "woodpecker",
    "crow",
    "raven",
    "pigeon",
    "seagull",
    "pelican",
    "stingray",
    "carp",
    "goldfish",
    "koi",
    "anglerfish",
    "phoenix",
    "griffin",
    "centaur",
    "minotaur",
    "cyclops",
    "goblin",
    "fairy",
    "elf",
    "dwarf",
    "giant",
    "space whale",
    "lava monster",
    "ice golem",
    "cloud spirit",
    "tree guardian",
    "clockwork owl",
    "city bus",
    "paper airplane"
  ];

  const actions = [
    "juggling flaming torches",
    "riding a skateboard downhill",
    "balancing on a giant pizza",
    "dancing in the rain",
    "baking cookies",
    "playing electric guitar",
    "painting a mural",
    "flying a kite",
    "building a treehouse",
    "reading a map upside down",
    "surfing a tidal wave",
    "eating spaghetti",
    "blowing giant bubbles",
    "watering a cactus",
    "carrying too many books",
    "hula hooping",
    "drinking bubble tea",
    "playing chess",
    "hiding behind a lamp",
    "doing a backflip",
    "spinning a basketball",
    "singing opera",
    "jumping over puddles",
    "taking a selfie",
    "folding paper cranes",
    "typing on a tiny laptop",
    "playing table tennis",
    "walking a balloon dog",
    "ice skating",
    "skiing backwards",
    "snowboarding",
    "building a snow fort",
    "sledding down a hill",
    "making a sandcastle",
    "scuba diving",
    "snorkeling",
    "kayaking",
    "paddling a canoe",
    "racing a shopping cart",
    "driving a go-kart",
    "fixing a spaceship",
    "launching fireworks",
    "planting sunflowers",
    "chasing butterflies",
    "feeding ducks",
    "playing hide and seek",
    "solving a maze",
    "escaping quicksand",
    "climbing a ladder",
    "swinging on a vine",
    "walking a tightrope",
    "doing yoga",
    "meditating",
    "lifting tiny dumbbells",
    "bench pressing a cloud",
    "hammering nails",
    "sewing a cape",
    "knitting a scarf",
    "drumming on buckets",
    "conducting an orchestra",
    "playing the violin",
    "playing the flute",
    "playing the trumpet",
    "blowing a saxophone",
    "writing a poem",
    "studying for an exam",
    "taking notes",
    "spilling coffee",
    "carrying groceries",
    "riding a unicycle",
    "walking stilts",
    "catching a frisbee",
    "throwing a boomerang",
    "flying a drone",
    "taking moon rocks home",
    "pushing a giant button",
    "opening a treasure chest",
    "digging for fossils",
    "hatching an egg",
    "brushing giant teeth",
    "washing a car",
    "vacuuming the ceiling",
    "mopping a rainbow",
    "washing windows",
    "peeling a banana",
    "flipping pancakes",
    "grilling burgers",
    "making sushi",
    "decorating cupcakes",
    "mixing a potion",
    "stirring a cauldron",
    "casting a spell",
    "shooting arrows",
    "swinging a sword",
    "raising a shield",
    "fencing",
    "playing soccer",
    "kicking a field goal",
    "pitching a baseball",
    "shooting hoops",
    "serving a volleyball",
    "lifting a trophy",
    "waving from a parade float",
    "marching in a band",
    "wrestling an octopus",
    "tickling a dragon",
    "sneaking through lasers",
    "hacking a vending machine",
    "walking through a portal",
    "time traveling",
    "teleporting",
    "hovering above the ground",
    "moonwalking",
    "doing the worm dance",
    "breakdancing",
    "tap dancing",
    "ballet dancing",
    "line dancing",
    "cheering at a concert",
    "selling lemonade",
    "running a food truck",
    "delivering pizza",
    "mailing a giant letter",
    "stamping passports",
    "guiding a tour group",
    "discovering a hidden cave",
    "camping under stars",
    "toasting marshmallows",
    "starting a campfire",
    "telling ghost stories",
    "chasing a runaway hat",
    "fishing in a puddle",
    "lifting a boulder",
    "rolling downhill",
    "dodging meteors",
    "surfing on lava",
    "building a robot",
    "charging batteries",
    "rewiring a machine",
    "coding a game",
    "debugging all night",
    "printing stickers",
    "making pottery",
    "carving ice sculptures",
    "blowing glass",
    "gardening on a rooftop",
    "watering floating plants",
    "riding a carousel",
    "winning a claw machine",
    "feeding an arcade token",
    "playing pinball",
    "solving a crossword",
    "stacking dominoes",
    "playing cards",
    "rolling dice",
    "building a pillow fort",
    "jumping on a trampoline",
    "bouncing a pogo stick",
    "walking a slackline",
    "racing snails",
    "painting miniatures",
    "collecting seashells",
    "polishing a crown",
    "guarding a castle",
    "rowing a Viking boat",
    "sailing through a storm",
    "steering a hot air balloon",
    "parachuting",
    "hang gliding",
    "climbing an ice wall",
    "forging a key",
    "unlocking a secret door",
    "escaping a maze",
    "chopping vegetables",
    "making ramen",
    "pouring tea",
    "juggling oranges",
    "catching snowflakes",
    "playing with sparklers",
    "wrapping gifts",
    "decorating a tree",
    "ringing a bell",
    "blowing out candles",
    "opening presents",
    "training for a marathon",
    "sprinting through mud",
    "climbing a mountain",
    "crossing a rope bridge",
    "photographing birds",
    "painting clouds",
    "writing in a diary",
    "reading under a blanket",
    "building a rocket",
    "floating in zero gravity",
    "walking on the moon",
    "repairing a satellite",
    "waving a flag",
    "spinning plates",
    "making shadow puppets",
    "playing with glow sticks"
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function withArticle(noun) {
    const cleanNoun = noun.trim();
    const firstWord = cleanNoun.split(/\s+/)[0].toLowerCase();

    if (/^(honest|hour|heir|honor)/.test(firstWord)) {
      return `an ${cleanNoun}`;
    }

    if (/^(uni([^nmd]|$)|use|user|ufo|euro)/.test(firstWord)) {
      return `a ${cleanNoun}`;
    }

    if (/^[aeiou]/.test(firstWord)) {
      return `an ${cleanNoun}`;
    }

    return `a ${cleanNoun}`;
  }

  function formatPromptText(subject, action) {
    const cleanAction = action.trim().replace(/\s+/g, " ");
    return `Draw ${withArticle(subject)} ${cleanAction}`;
  }

  function getPromptTopicOptions() {
    return [
      { key: "any", label: "Any Topic" },
      { key: "fantasy", label: "Fantasy" },
      { key: "animals", label: "Animals" },
      { key: "jobs", label: "Jobs" },
      { key: "space", label: "Space" },
      { key: "sports", label: "Sports" },
      { key: "food", label: "Food" },
      { key: "travel", label: "Travel" },
      { key: "music", label: "Music" },
      { key: "ocean", label: "Ocean" }
    ];
  }

  function pickSubjectPool(topicKey) {
    switch (topicKey) {
      case "fantasy":
        return subjects.filter((item) => /dragon|unicorn|mermaid|vampire|werewolf|wizard|knight|ghost|zombie|pirate|ninja|samurai|superhero|villain|princess|prince|queen|king|court jester|phoenix|griffin|centaur|minotaur|cyclops|goblin|fairy|elf|dwarf|giant|lava monster|ice golem|cloud spirit|tree guardian/i.test(item));
      case "animals":
        return subjects.filter((item) => /penguin|otter|fox|wolf|bear|tiger|lion|elephant|giraffe|koala|kangaroo|sloth|owl|eagle|flamingo|peacock|parrot|duck|goose|swan|shark|dolphin|whale|octopus|jellyfish|starfish|crab|lobster|seahorse|pufferfish|chameleon|iguana|crocodile|alligator|frog|toad|snail|butterfly|dragonfly|ladybug|bumblebee|ant|spider|raccoon|hedgehog|hamster|guinea pig|rabbit|deer|moose|boar|yak|alpaca|llama|camel|reindeer|polar bear|cat|dog|mountain goat|squirrel|chipmunk|ferret|badger|mole|beaver|seal|walrus|narwhal|manta ray|squid|orca|rhino|hippo|zebra|buffalo|cheetah|panther|leopard|hyena|meerkat|lemur|gorilla|chimpanzee|orangutan|panda|red panda|toucan|woodpecker|crow|raven|pigeon|seagull|pelican|stingray|carp|goldfish|koi|anglerfish/i.test(item));
      case "jobs":
        return subjects.filter((item) => /detective|chef|doctor|scientist|teacher|pilot|firefighter|lifeguard|beekeeper|farmer|musician|streamer|inventor|explorer|blacksmith|carpenter|potter|tailor|baker|barista|mail carrier|librarian|engineer|mechanic|plumber|electrician|gardener|florist|photographer|filmmaker|news reporter|archaeologist|paleontologist|astronomer|meteorologist|race car driver|train conductor|bus driver|taxi driver|delivery rider/i.test(item));
      case "space":
        return subjects.filter((item) => /astronaut|alien|robot|pilot|space cat|space dog|hamster astronaut|time traveler|astronomer|space whale/i.test(item));
      case "sports":
        return subjects.filter((item) => /dancer|gamer|surfer|skater|cyclist|hiker|archer|race car driver/i.test(item));
      case "food":
        return subjects.filter((item) => /chef|baker|barista|farmer|gingerbread man/i.test(item));
      case "travel":
        return subjects.filter((item) => /explorer|pilot|train conductor|bus driver|taxi driver|delivery rider|time traveler|camel|reindeer|city bus|paper airplane/i.test(item));
      case "music":
        return subjects.filter((item) => /musician|dancer|streamer|peacock|parrot|court jester|clown|juggler|magician|acrobat/i.test(item));
      case "ocean":
        return subjects.filter((item) => /mermaid|shark|dolphin|whale|octopus|jellyfish|starfish|crab|lobster|seahorse|pufferfish|seal|walrus|narwhal|manta ray|squid|orca|stingray|carp|goldfish|koi|anglerfish/i.test(item));
      default:
        return subjects;
    }
  }

  function pickActionPool(topicKey) {
    switch (topicKey) {
      case "fantasy":
        return actions.filter((item) => /casting a spell|mixing a potion|stirring a cauldron|opening a treasure chest|digging for fossils|walking through a portal|time traveling|teleporting|hovering above the ground|guarding a castle|rowing a Viking boat|sailing through a storm|unlocking a secret door|telling ghost stories/i.test(item));
      case "animals":
        return actions.filter((item) => /chasing butterflies|feeding ducks|hatching an egg|photographing birds|collecting seashells|fishing in a puddle|watering floating plants/i.test(item));
      case "jobs":
        return actions.filter((item) => /baking cookies|painting a mural|reading a map upside down|fixing a spaceship|planting sunflowers|hammering nails|sewing a cape|knitting a scarf|drumming on buckets|conducting an orchestra|writing a poem|studying for an exam|taking notes|carrying groceries|building a robot|rewiring a machine|coding a game|debugging all night|making pottery|blowing glass|gardening on a rooftop|guiding a tour group|discovering a hidden cave|building a rocket|repairing a satellite/i.test(item));
      case "space":
        return actions.filter((item) => /fixing a spaceship|taking moon rocks home|dodging meteors|walking through a portal|time traveling|teleporting|building a rocket|floating in zero gravity|walking on the moon|repairing a satellite|waving a flag/i.test(item));
      case "sports":
        return actions.filter((item) => /riding a skateboard downhill|doing a backflip|spinning a basketball|ice skating|skiing backwards|snowboarding|sledding down a hill|kayaking|paddling a canoe|driving a go-kart|shooting arrows|fencing|playing soccer|kicking a field goal|pitching a baseball|shooting hoops|serving a volleyball|lifting a trophy|training for a marathon|sprinting through mud|climbing a mountain|crossing a rope bridge/i.test(item));
      case "food":
        return actions.filter((item) => /baking cookies|eating spaghetti|drinking bubble tea|flipping pancakes|grilling burgers|making sushi|decorating cupcakes|selling lemonade|running a food truck|delivering pizza|chopping vegetables|making ramen|pouring tea|juggling oranges|blowing out candles|opening presents/i.test(item));
      case "travel":
        return actions.filter((item) => /flying a kite|reading a map upside down|kayaking|paddling a canoe|driving a go-kart|mailing a giant letter|stamping passports|guiding a tour group|discovering a hidden cave|camping under stars|starting a campfire|steering a hot air balloon|parachuting|hang gliding|climbing a mountain|crossing a rope bridge|walking on the moon/i.test(item));
      case "music":
        return actions.filter((item) => /playing electric guitar|singing opera|drumming on buckets|conducting an orchestra|playing the violin|playing the flute|playing the trumpet|blowing a saxophone|marching in a band|cheering at a concert|playing pinball|ringing a bell/i.test(item));
      case "ocean":
        return actions.filter((item) => /surfing a tidal wave|scuba diving|snorkeling|kayaking|paddling a canoe|feeding ducks|fishing in a puddle|collecting seashells|sailing through a storm/i.test(item));
      default:
        return actions;
    }
  }

  function getRandomPrompt(topicKey = "any") {
    const subjectPool = pickSubjectPool(topicKey);
    const actionPool = pickActionPool(topicKey);

    const safeSubjects = subjectPool.length ? subjectPool : subjects;
    const safeActions = actionPool.length ? actionPool : actions;

    const subject = pick(safeSubjects);
    const action = pick(safeActions);
    return {
      subject,
      action,
      text: formatPromptText(subject, action)
    };
  }

  global.PROMPTS = {
    subjects,
    actions,
    getRandomPrompt,
    getPromptTopicOptions
  };
})(window);
