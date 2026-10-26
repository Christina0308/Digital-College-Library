export type DemoPlacement = {
  status: "available" | "borrowed" | "reserved";
  building: string;
  floor: string;
  section: string;
  shelf: string;
  rack: string;
};

export type DemoBook = {
  title: string;
  author: string;
  isbn: string;
  category: string;
  year: number;
  publisher: string;
  description: string;
};

export const demoCategories = [
  { name: "Computer science", slug: "computer-science", description: "Software, systems, data, and the future of computing." },
  { name: "Java", slug: "java", description: "Core Java, the JVM, object-oriented design, and enterprise fundamentals." },
  { name: "C++", slug: "cpp", description: "Modern C++, templates, memory, and high-performance programming." },
  { name: "Python", slug: "python", description: "Python fundamentals, data work, algorithms, and automation." },
  { name: "Data structures", slug: "data-structures", description: "Algorithms, complexity, and the structures behind good software." },
  { name: "Engineering mathematics", slug: "engineering-mathematics", description: "Calculus, differential equations, transforms, and applied numerical methods." },
  { name: "AutoCAD & design", slug: "autocad-design", description: "CAD drafting, engineering graphics, and technical drawing standards." },
  { name: "Literature", slug: "literature", description: "Stories, poetry, drama, and works that stay with you." },
  { name: "Science", slug: "science", description: "Big questions about the natural world and our place in it." },
  { name: "Business", slug: "business", description: "Ideas for building, leading, and working better." },
  { name: "Psychology", slug: "psychology", description: "How people think, feel, and make meaning." },
];

export const demoBooks: DemoBook[] = [
  {
    title: "The Pragmatic Programmer", author: "David Thomas & Andrew Hunt", isbn: "9780135957059", category: "computer-science", year: 2019,
    publisher: "Addison-Wesley", description: "A practical guide to the habits and tools that help software developers turn good ideas into reliable, maintainable code. Updated for a new generation of programmers.",
  },
  {
    title: "Clean Code", author: "Robert C. Martin", isbn: "9780132350884", category: "computer-science", year: 2008,
    publisher: "Prentice Hall", description: "A thoughtful handbook on writing readable, expressive code and leaving software better than you found it.",
  },
  {
    title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", isbn: "9781449373320", category: "computer-science", year: 2017,
    publisher: "O’Reilly Media", description: "A clear tour of the principles, trade-offs, and foundations behind reliable, scalable data systems.",
  },
  {
    title: "Java: The Complete Reference", author: "Herbert Schildt & Danny Coward", isbn: "9781265058432", category: "java", year: 2024,
    publisher: "McGraw Hill", description: "The definitive Java programming guide, fully updated for Java SE 21. Covers syntax, classes, generics, collections, lambdas, streams, concurrency, and the modules system with hundreds of worked examples.",
  },
  {
    title: "Head First Java", author: "Kathy Sierra, Bert Bates & Trisha Gee", isbn: "9781491910771", category: "java", year: 2022,
    publisher: "O’Reilly Media", description: "A brain-friendly introduction to Java and object-oriented programming. The third edition covers Java 8–17 with puzzles, visuals, and hands-on exercises on lambdas, streams, generics, and threading.",
  },
  {
    title: "Core Java, Volume I: Fundamentals", author: "Cay S. Horstmann", isbn: "9780137673629", category: "java", year: 2022,
    publisher: "Pearson", description: "A thorough, example-driven grounding in the Java language and core libraries: objects, interfaces, inheritance, exceptions, collections, and concurrency for serious application development.",
  },
  {
    title: "C++ Primer", author: "Stanley B. Lippman, Josée Lajoie & Barbara E. Moo", isbn: "9780321714114", category: "cpp", year: 2012,
    publisher: "Addison-Wesley Professional", description: "The classic, thoroughly modern introduction to C++11. Teaches the language through the standard library first, then classes, templates, and the facilities that make C++ both fast and expressive.",
  },
  {
    title: "C++ Templates: The Complete Guide", author: "David Vandevoorde, Nicolai M. Josuttis & Douglas Gregor", isbn: "9780321714121", category: "cpp", year: 2017,
    publisher: "Addison-Wesley Professional", description: "A complete reference for generic programming in C++: function and class templates, variadic templates, type traits, overload resolution, and the metaprogramming techniques behind modern libraries.",
  },
  {
    title: "Programming: Principles and Practice Using C++", author: "Bjarne Stroustrup", isbn: "9780321992789", category: "cpp", year: 2014,
    publisher: "Addison-Wesley Professional", description: "An introduction to programming from the creator of C++. Builds good habits around correctness, testing, and design while teaching modern C++ through practical, progressively harder projects.",
  },
  {
    title: "Python Crash Course", author: "Eric Matthes", isbn: "9781718502703", category: "python", year: 2023,
    publisher: "No Starch Press", description: "A fast-paced, hands-on introduction to Python. Part one covers variables, lists, dictionaries, classes, files, and testing; part two builds a game, data visualisations, and a deployed web application.",
  },
  {
    title: "Data Structures and Algorithms in Python", author: "Michael T. Goodrich, Roberto Tamassia & Michael H. Goldwasser", isbn: "9781118290279", category: "python", year: 2013,
    publisher: "Wiley", description: "A rigorous, object-oriented treatment of data structures and algorithms using Python: recursion, arrays, linked lists, trees, hash tables, graphs, and the analysis techniques that connect them.",
  },
  {
    title: "Fluent Python", author: "Luciano Ramalho", isbn: "9781492056355", category: "python", year: 2022,
    publisher: "O’Reilly Media", description: "Write shorter, faster, more readable Python by working with the language rather than against it. Covers the data model, iterables, coroutines, type hints, and idiomatic concurrency.",
  },
  {
    title: "Introduction to Algorithms", author: "Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest & Clifford Stein", isbn: "9780262046305", category: "data-structures", year: 2022,
    publisher: "MIT Press", description: "The standard reference for algorithms: sorting, data structures, graph algorithms, dynamic programming, and complexity analysis, presented with proofs and pseudocode you can implement in any language.",
  },
  {
    title: "Advanced Engineering Mathematics", author: "Erwin Kreyszig, Herbert Kreyszig & Edward J. Norminton", isbn: "9780470458365", category: "engineering-mathematics", year: 2011,
    publisher: "Wiley", description: "The core mathematics of engineering: ordinary and partial differential equations, linear algebra, vector calculus, Fourier analysis, complex analysis, and numerical methods with applied problem sets.",
  },
  {
    title: "Engineering Mathematics", author: "K. A. Stroud & Dexter J. Booth", isbn: "9781352010275", category: "engineering-mathematics", year: 2020,
    publisher: "Red Globe Press", description: "A programmed, step-by-step course through engineering mathematics. Each topic is broken into short frames with worked examples, revision tests, and answers so students can learn and check independently.",
  },
  {
    title: "Higher Engineering Mathematics", author: "B. S. Grewal", isbn: "9788174091956", category: "engineering-mathematics", year: 2017,
    publisher: "Khanna Publishers", description: "A comprehensive reference for undergraduate engineering mathematics, covering algebra, calculus, differential equations, transforms, probability, and numerical techniques with extensive solved problems.",
  },
  {
    title: "AutoCAD and Its Applications: Basics", author: "Terence M. Shumaker, David A. Madsen & David P. Madsen", isbn: "9781635638646", category: "autocad-design", year: 2019,
    publisher: "Goodheart-Willcox", description: "A complete introduction to 2D drafting with AutoCAD: drawing and editing commands, layers, dimensioning, blocks, plotting, and the industry standards behind professional construction and mechanical drawings.",
  },
  {
    title: "Technical Drawing with Engineering Graphics", author: "Frederick E. Giesecke, Alva Mitchell, Henry Cecil Spencer, Ivan Leroy Hill, John Thomas Dygdon, James E. Novak & Shawna Lockhart", isbn: "9780135019757", category: "autocad-design", year: 2016,
    publisher: "Pearson", description: "The long-standing reference for engineering graphics: orthographic projection, sectional and auxiliary views, tolerancing, threads and fasteners, and CAD-based drawing practice for engineering students.",
  },
  {
    title: "The Midnight Library", author: "Matt Haig", isbn: "9780525559474", category: "literature", year: 2020,
    publisher: "Viking", description: "Between life and death there is a library, and within that library, the shelves go on forever. A tender novel about second chances and the lives we might have lived.",
  },
  {
    title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "9780743273565", category: "literature", year: 1925,
    publisher: "Scribner", description: "A luminous portrait of ambition, longing, and the American dream on Long Island in the summer of 1922.",
  },
  {
    title: "A Brief History of Time", author: "Stephen Hawking", isbn: "9780553380163", category: "science", year: 1998,
    publisher: "Bantam Books", description: "From the Big Bang to black holes, one of the world's great physicists makes the universe accessible to curious readers everywhere.",
  },
  {
    title: "Cosmos", author: "Carl Sagan", isbn: "9780345539434", category: "science", year: 1980,
    publisher: "Random House", description: "A sweeping, joyful journey through science, history, and the wonder of our place in the cosmos.",
  },
  {
    title: "Thinking, Fast and Slow", author: "Daniel Kahneman", isbn: "9780374533557", category: "psychology", year: 2011,
    publisher: "Farrar, Straus and Giroux", description: "A Nobel Prize-winning psychologist explores the two systems that shape how we think, choose, and understand the world.",
  },
  {
    title: "Atomic Habits", author: "James Clear", isbn: "9780735211292", category: "business", year: 2018,
    publisher: "Avery", description: "A practical, evidence-informed framework for building good habits, breaking bad ones, and making small changes add up.",
  },
  {
    title: "The Lean Startup", author: "Eric Ries", isbn: "9780307887894", category: "business", year: 2011,
    publisher: "Crown Business", description: "A new approach to building products and organizations that helps entrepreneurs test ideas, learn from customers, and adapt quickly.",
  },
];

function technologyCopies(section: string, shelf: string, count: number, floor = "2"): DemoPlacement[] {
  return Array.from({ length: count }, (_, index) => ({
    status: "available" as const,
    building: "Founders Library",
    floor,
    section,
    shelf,
    rack: `Rack ${index + 1}`,
  }));
}

export const demoCopies: Record<string, DemoPlacement[]> = {
  "9780135957059": [
    { status: "available", building: "Founders Library", floor: "2", section: "Technology", shelf: "CS-04", rack: "Rack 2" },
    { status: "available", building: "Founders Library", floor: "2", section: "Technology", shelf: "CS-04", rack: "Rack 3" },
    { status: "borrowed", building: "Founders Library", floor: "2", section: "Technology", shelf: "CS-04", rack: "Rack 4" },
  ],
  "9780132350884": [
    { status: "available", building: "Founders Library", floor: "2", section: "Technology", shelf: "CS-04", rack: "Rack 5" },
    { status: "available", building: "Founders Library", floor: "2", section: "Technology", shelf: "CS-04", rack: "Rack 6" },
  ],
  "9781449373320": [
    { status: "reserved", building: "Founders Library", floor: "2", section: "Technology", shelf: "CS-05", rack: "Rack 1" },
    { status: "available", building: "Founders Library", floor: "2", section: "Technology", shelf: "CS-05", rack: "Rack 2" },
  ],
  "9781265058432": technologyCopies("Programming · Java", "JAVA-01", 3),
  "9781491910771": technologyCopies("Programming · Java", "JAVA-02", 2),
  "9780137673629": technologyCopies("Programming · Java", "JAVA-03", 2),
  "9780321714114": technologyCopies("Programming · C++", "CPP-01", 3),
  "9780321714121": technologyCopies("Programming · C++", "CPP-02", 2),
  "9780321992789": technologyCopies("Programming · C++", "CPP-03", 2),
  "9781718502703": technologyCopies("Programming · Python", "PY-01", 3),
  "9781118290279": technologyCopies("Programming · Python", "PY-02", 2),
  "9781492056355": technologyCopies("Programming · Python", "PY-03", 2),
  "9780262046305": technologyCopies("Algorithms", "DS-01", 3),
  "9780470458365": technologyCopies("Engineering mathematics", "MATH-04", 3, "3"),
  "9781352010275": technologyCopies("Engineering mathematics", "MATH-05", 3, "3"),
  "9788174091956": technologyCopies("Engineering mathematics", "MATH-06", 2, "3"),
  "9781635638646": [
    ...technologyCopies("CAD & engineering graphics", "CAD-01", 2, "1"),
    { status: "available", building: "Engineering Library", floor: "1", section: "Design studio reference", shelf: "CAD-07", rack: "Rack 3" },
  ],
  "9780135019757": technologyCopies("CAD & engineering graphics", "CAD-02", 2, "1"),
  "9780525559474": [
    { status: "available", building: "Arts Library", floor: "1", section: "Contemporary fiction", shelf: "LIT-12", rack: "Rack 1" },
    { status: "available", building: "Arts Library", floor: "1", section: "Contemporary fiction", shelf: "LIT-12", rack: "Rack 2" },
    { status: "available", building: "Arts Library", floor: "1", section: "Contemporary fiction", shelf: "LIT-12", rack: "Rack 3" },
  ],
  "9780743273565": [
    { status: "available", building: "Arts Library", floor: "1", section: "American literature", shelf: "LIT-03", rack: "Rack 4" },
    { status: "borrowed", building: "Arts Library", floor: "1", section: "American literature", shelf: "LIT-03", rack: "Rack 5" },
  ],
  "9780553380163": [
    { status: "available", building: "Founders Library", floor: "3", section: "Physics", shelf: "SCI-02", rack: "Rack 1" },
    { status: "available", building: "Founders Library", floor: "3", section: "Physics", shelf: "SCI-02", rack: "Rack 2" },
  ],
  "9780345539434": [
    { status: "available", building: "Founders Library", floor: "3", section: "Astronomy", shelf: "SCI-05", rack: "Rack 1" },
    { status: "available", building: "Founders Library", floor: "3", section: "Astronomy", shelf: "SCI-05", rack: "Rack 2" },
  ],
  "9780374533557": [
    { status: "available", building: "Wellness Library", floor: "1", section: "Behavioral science", shelf: "PSY-02", rack: "Rack 3" },
    { status: "available", building: "Wellness Library", floor: "1", section: "Behavioral science", shelf: "PSY-02", rack: "Rack 4" },
  ],
  "9780735211292": [
    { status: "available", building: "Founders Library", floor: "1", section: "Business", shelf: "BUS-06", rack: "Rack 1" },
    { status: "available", building: "Founders Library", floor: "1", section: "Business", shelf: "BUS-06", rack: "Rack 2" },
  ],
  "9780307887894": [
    { status: "available", building: "Founders Library", floor: "1", section: "Business", shelf: "BUS-07", rack: "Rack 1" },
    { status: "available", building: "Founders Library", floor: "1", section: "Business", shelf: "BUS-07", rack: "Rack 2" },
  ],
};
