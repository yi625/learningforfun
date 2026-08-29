// ============================================================
// Chinese for Kids (华语乐园) — Curriculum Data
// Levels: Kindergarten to Standard 3 (0 Knowledge to Primary 3)
// ============================================================

const LEVELS = [
  {
    id: 1,
    grade: "幼儿园 (Kindergarten)",
    name: "启蒙基础篇 (Basics)",
    titleEn: "Preschool Basics",
    description: "Numbers, colors, family & cute animals (认识数字、颜色、家庭与动物) 🌱",
    icon: "🌱",
    color: "#FF6B6B",
    bgGradient: "linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%)",
    requiredScore: 80,
    vocabulary: [
      // Numbers
      { hanzi: "一", pinyin: "yī", english: "One (1)", emoji: "1️⃣", category: "数字 Number", type: "word" },
      { hanzi: "二", pinyin: "èr", english: "Two (2)", emoji: "2️⃣", category: "数字 Number", type: "word" },
      { hanzi: "三", pinyin: "sān", english: "Three (3)", emoji: "3️⃣", category: "数字 Number", type: "word" },
      { hanzi: "四", pinyin: "sì", english: "Four (4)", emoji: "4️⃣", category: "数字 Number", type: "word" },
      { hanzi: "五", pinyin: "wǔ", english: "Five (5)", emoji: "5️⃣", category: "数字 Number", type: "word" },
      { hanzi: "六", pinyin: "liù", english: "Six (6)", emoji: "6️⃣", category: "数字 Number", type: "word" },
      { hanzi: "七", pinyin: "qī", english: "Seven (7)", emoji: "7️⃣", category: "数字 Number", type: "word" },
      { hanzi: "八", pinyin: "bā", english: "Eight (8)", emoji: "8️⃣", category: "数字 Number", type: "word" },
      { hanzi: "九", pinyin: "jiǔ", english: "Nine (9)", emoji: "9️⃣", category: "数字 Number", type: "word" },
      { hanzi: "十", pinyin: "shí", english: "Ten (10)", emoji: "🔟", category: "数字 Number", type: "word" },
      // Family
      { hanzi: "爸爸", pinyin: "bà ba", english: "Father / Dad", emoji: "👨", category: "家庭 Family", type: "word" },
      { hanzi: "妈妈", pinyin: "mā ma", english: "Mother / Mom", emoji: "👩", category: "家庭 Family", type: "word" },
      { hanzi: "哥哥", pinyin: "gē ge", english: "Elder Brother", emoji: "👦", category: "家庭 Family", type: "word" },
      { hanzi: "姐姐", pinyin: "jiě jie", english: "Elder Sister", emoji: "👧", category: "家庭 Family", type: "word" },
      { hanzi: "弟弟", pinyin: "dì di", english: "Younger Brother", emoji: "👶", category: "家庭 Family", type: "word" },
      { hanzi: "妹妹", pinyin: "mèi mei", english: "Younger Sister", emoji: "🧒", category: "家庭 Family", type: "word" },
      // Colors & Nature
      { hanzi: "红色", pinyin: "hóng sè", english: "Red", emoji: "🔴", category: "颜色 Color", type: "word" },
      { hanzi: "蓝色", pinyin: "lán sè", english: "Blue", emoji: "🔵", category: "颜色 Color", type: "word" },
      { hanzi: "黄色", pinyin: "huáng sè", english: "Yellow", emoji: "🟡", category: "颜色 Color", type: "word" },
      { hanzi: "太阳", pinyin: "tài yáng", english: "Sun", emoji: "☀️", category: "自然 Nature", type: "word" },
      { hanzi: "月亮", pinyin: "yuè liang", english: "Moon", emoji: "🌙", category: "自然 Nature", type: "word" },
      // Animals & Body
      { hanzi: "猫", pinyin: "māo", english: "Cat", emoji: "🐱", category: "动物 Animal", type: "word" },
      { hanzi: "狗", pinyin: "gǒu", english: "Dog", emoji: "🐶", category: "动物 Animal", type: "word" },
      { hanzi: "鸟", pinyin: "niǎo", english: "Bird", emoji: "🐦", category: "动物 Animal", type: "word" },
      { hanzi: "眼睛", pinyin: "yǎn jing", english: "Eyes", emoji: "👀", category: "身体 Body", type: "word" },
      { hanzi: "小手", pinyin: "xiǎo shǒu", english: "Hand", emoji: "✋", category: "身体 Body", type: "word" }
    ]
  },
  {
    id: 2,
    grade: "一年级 (Standard 1)",
    name: "校园与生活篇 (School & Life)",
    titleEn: "School & Daily Life",
    description: "School stationery, polite greetings & yummy foods (文具、日常礼貌与食物) 🎒",
    icon: "🎒",
    color: "#4ECDC4",
    bgGradient: "linear-gradient(135deg, #A8EDEA 0%, #FED6E3 100%)",
    requiredScore: 80,
    vocabulary: [
      // School & Classroom
      { hanzi: "老师", pinyin: "lǎo shī", english: "Teacher", emoji: "👩‍🏫", category: "学校 School", type: "word" },
      { hanzi: "同学", pinyin: "tóng xué", english: "Classmate", emoji: "🧑‍🤝‍🧑", category: "学校 School", type: "word" },
      { hanzi: "书包", pinyin: "shū bāo", english: "Schoolbag", emoji: "🎒", category: "文具 Stationeries", type: "word" },
      { hanzi: "铅笔", pinyin: "qiān bǐ", english: "Pencil", emoji: "✏️", category: "文具 Stationeries", type: "word" },
      { hanzi: "尺子", pinyin: "chǐ zi", english: "Ruler", emoji: "📏", category: "文具 Stationeries", type: "word" },
      { hanzi: "橡皮", pinyin: "xiàng pí", english: "Eraser", emoji: "🧼", category: "文具 Stationeries", type: "word" },
      // Greetings & Manners
      { hanzi: "早上好", pinyin: "zǎo shang hǎo", english: "Good Morning", emoji: "🌅", category: "礼貌 Greetings", type: "phrase" },
      { hanzi: "谢谢", pinyin: "xiè xie", english: "Thank You", emoji: "🙏", category: "礼貌 Greetings", type: "phrase" },
      { hanzi: "对不起", pinyin: "duì bu qǐ", english: "Sorry", emoji: "🙇", category: "礼貌 Greetings", type: "phrase" },
      { hanzi: "没关系", pinyin: "méi guān xi", english: "It's Okay / No Problem", emoji: "👌", category: "礼貌 Greetings", type: "phrase" },
      { hanzi: "再见", pinyin: "zài jiàn", english: "Goodbye", emoji: "👋", category: "礼貌 Greetings", type: "phrase" },
      // Daily Actions
      { hanzi: "读书", pinyin: "dú shū", english: "Read Book", emoji: "📖", category: "动作 Action", type: "phrase" },
      { hanzi: "写字", pinyin: "xiě zì", english: "Write", emoji: "✍️", category: "动作 Action", type: "phrase" },
      { hanzi: "画画", pinyin: "huà huà", english: "Draw / Paint", emoji: "🎨", category: "动作 Action", type: "phrase" },
      { hanzi: "吃饭", pinyin: "chī fàn", english: "Eat Rice / Meal", emoji: "🍚", category: "动作 Action", type: "phrase" },
      { hanzi: "喝水", pinyin: "hē shuǐ", english: "Drink Water", emoji: "🥤", category: "动作 Action", type: "phrase" },
      // Foods & Fruits
      { hanzi: "苹果", pinyin: "píng guǒ", english: "Apple", emoji: "🍎", category: "水果 Fruit", type: "word" },
      { hanzi: "香蕉", pinyin: "xiāng jiāo", english: "Banana", emoji: "🍌", category: "水果 Fruit", type: "word" },
      { hanzi: "西瓜", pinyin: "xī guā", english: "Watermelon", emoji: "🍉", category: "水果 Fruit", type: "word" },
      { hanzi: "面包", pinyin: "miàn bāo", english: "Bread", emoji: "🍞", category: "食物 Food", type: "word" },
      { hanzi: "牛奶", pinyin: "niú nǎi", english: "Milk", emoji: "🥛", category: "食物 Food", type: "word" }
    ]
  },
  {
    id: 3,
    grade: "二年级 (Standard 2)",
    name: "情感与探索篇 (Feelings & World)",
    titleEn: "Feelings & Exploration",
    description: "Feelings, weather, opposites & sports (心情感受、天气、反义词与运动) 🌟",
    icon: "🌟",
    color: "#FFA07A",
    bgGradient: "linear-gradient(135deg, #FFE259 0%, #FFA751 100%)",
    requiredScore: 80,
    vocabulary: [
      // Emotions
      { hanzi: "开心", pinyin: "kāi xīn", english: "Happy", emoji: "😄", category: "心情 Emotion", type: "word" },
      { hanzi: "伤心", pinyin: "shāng xīn", english: "Sad", emoji: "😢", category: "心情 Emotion", type: "word" },
      { hanzi: "生气", pinyin: "shēng qì", english: "Angry", emoji: "😡", category: "心情 Emotion", type: "word" },
      { hanzi: "害怕", pinyin: "hài pà", english: "Scared / Afraid", emoji: "😨", category: "心情 Emotion", type: "word" },
      { hanzi: "勇敢", pinyin: "yǒng gǎn", english: "Brave", emoji: "🦁", category: "心情 Emotion", type: "word" },
      // Weather & Time
      { hanzi: "晴天", pinyin: "qíng tiān", english: "Sunny Day", emoji: "☀️", category: "天气 Weather", type: "word" },
      { hanzi: "下雨", pinyin: "xià yǔ", english: "Rain / Rainy", emoji: "🌧️", category: "天气 Weather", type: "word" },
      { hanzi: "刮风", pinyin: "guā fēng", english: "Windy", emoji: "💨", category: "天气 Weather", type: "word" },
      { hanzi: "今天", pinyin: "jīn tiān", english: "Today", emoji: "📅", category: "时间 Time", type: "word" },
      { hanzi: "明天", pinyin: "míng tiān", english: "Tomorrow", emoji: "📆", category: "时间 Time", type: "word" },
      // Opposites
      { hanzi: "大", pinyin: "dà", english: "Big", emoji: "🐘", category: "反义词 Opposite", type: "word" },
      { hanzi: "小", pinyin: "xiǎo", english: "Small", emoji: "🐭", category: "反义词 Opposite", type: "word" },
      { hanzi: "多", pinyin: "duō", english: "Many / Much", emoji: "🍇", category: "反义词 Opposite", type: "word" },
      { hanzi: "少", pinyin: "shǎo", english: "Few / Little", emoji: "🍒", category: "反义词 Opposite", type: "word" },
      { hanzi: "高", pinyin: "gāo", english: "Tall / High", emoji: "🦒", category: "反义词 Opposite", type: "word" },
      { hanzi: "矮", pinyin: "ǎi", english: "Short", emoji: "🦔", category: "反义词 Opposite", type: "word" },
      { hanzi: "快", pinyin: "kuài", english: "Fast", emoji: "🐆", category: "反义词 Opposite", type: "word" },
      { hanzi: "慢", pinyin: "màn", english: "Slow", emoji: "🐢", category: "反义词 Opposite", type: "word" },
      // Hobbies & Sports
      { hanzi: "唱歌", pinyin: "chàng gē", english: "Sing", emoji: "🎤", category: "活动 Hobby", type: "phrase" },
      { hanzi: "跳舞", pinyin: "tiào wǔ", english: "Dance", emoji: "💃", category: "活动 Hobby", type: "phrase" },
      { hanzi: "游泳", pinyin: "yóu yǒng", english: "Swim", emoji: "🏊", category: "活动 Hobby", type: "phrase" },
      { hanzi: "跑步", pinyin: "pǎo bù", english: "Run", emoji: "🏃", category: "活动 Hobby", type: "phrase" }
    ]
  },
  {
    id: 4,
    grade: "三年级 (Standard 3)",
    name: "社区、品德与成语篇 (Community & Idioms)",
    titleEn: "Community, Virtues & Idioms",
    description: "Places, transport, virtues & fun idioms (场所、交通工具、品德与成语) 🏆",
    icon: "🏆",
    color: "#6C5CE7",
    bgGradient: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
    requiredScore: 80,
    vocabulary: [
      // Community Places
      { hanzi: "学校", pinyin: "xué xiào", english: "School", emoji: "🏫", category: "场所 Place", type: "word" },
      { hanzi: "公园", pinyin: "gōng yuán", english: "Park", emoji: "🌳", category: "场所 Place", type: "word" },
      { hanzi: "医院", pinyin: "yī yuàn", english: "Hospital", emoji: "🏥", category: "场所 Place", type: "word" },
      { hanzi: "图书馆", pinyin: "tú shū guǎn", english: "Library", emoji: "📚", category: "场所 Place", type: "word" },
      { hanzi: "超市", pinyin: "chāo shì", english: "Supermarket", emoji: "🛒", category: "场所 Place", type: "word" },
      // Transport
      { hanzi: "汽车", pinyin: "qì chē", english: "Car", emoji: "🚗", category: "交通 Transport", type: "word" },
      { hanzi: "巴士", pinyin: "bā shì", english: "Bus", emoji: "🚌", category: "交通 Transport", type: "word" },
      { hanzi: "飞机", pinyin: "fēi jī", english: "Airplane", emoji: "✈️", category: "交通 Transport", type: "word" },
      { hanzi: "火车", pinyin: "huǒ chē", english: "Train", emoji: "🚆", category: "交通 Transport", type: "word" },
      { hanzi: "自行车", pinyin: "zì xíng chē", english: "Bicycle", emoji: "🚲", category: "交通 Transport", type: "word" },
      // Virtues & Manners
      { hanzi: "礼貌", pinyin: "lǐ mào", english: "Polite / Manners", emoji: "🤝", category: "品德 Virtue", type: "word" },
      { hanzi: "诚实", pinyin: "chéng shí", english: "Honest", emoji: "💎", category: "品德 Virtue", type: "word" },
      { hanzi: "勤劳", pinyin: "qín láo", english: "Hardworking", emoji: "🐝", category: "品德 Virtue", type: "word" },
      { hanzi: "团结", pinyin: "tuán jié", english: "United / Teamwork", emoji: "💪", category: "品德 Virtue", type: "word" },
      { hanzi: "爱护公物", pinyin: "ài hù gōng wù", english: "Care for Public Property", emoji: "🛡️", category: "品德 Virtue", type: "phrase" },
      // Idioms (Simple 4-character idioms suitable for Primary 3)
      { hanzi: "一心一意", pinyin: "yī xīn yī yì", english: "Wholeheartedly (Focused)", emoji: "🎯", category: "成语 Idiom", type: "phrase" },
      { hanzi: "助人为乐", pinyin: "zhù rén wéi lè", english: "Happy to Help Others", emoji: "❤️", category: "成语 Idiom", type: "phrase" },
      { hanzi: "井井有条", pinyin: "jǐng jǐng yǒu tiáo", english: "Neat and Tidy", emoji: "🗂️", category: "成语 Idiom", type: "phrase" },
      { hanzi: "自强不息", pinyin: "zì qiáng bù xī", english: "Strive Constantly for Success", emoji: "🌟", category: "成语 Idiom", type: "phrase" }
    ]
  }
];
