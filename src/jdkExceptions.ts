// jdkExceptions.ts
// A small hand-written table of facts about the Java standard library (JDK).
// The tool never sees the JDK's source code, so the Unreachable Handler detector
// uses these tables instead. They are deliberately incomplete: they cover the
// exceptions and methods that are common in real code. Anything missing is a
// documented limitation.

// Each table is written as a plain object { key: value } for readability, then turned
// into a Map. A Map is a dictionary; Map<string, string> means "keys are strings and
// values are strings". We use Map rather than a plain object for lookups because a
// plain object already has keys like "toString" and "constructor" built in, which are
// also common Java method names and would give wrong results.

// Child exception -> parent exception, for common JDK exceptions.
export const JDK_SUPERCLASS: Map<string, string> = new Map(Object.entries({
  // Throwable has two branches
  Exception: "Throwable",
  Error: "Throwable",

  // Checked exceptions (directly under Exception)
  IOException: "Exception",
  ReflectiveOperationException: "Exception",
  InterruptedException: "Exception",
  CloneNotSupportedException: "Exception",
  TimeoutException: "Exception",
  ExecutionException: "Exception",
  GeneralSecurityException: "Exception",
  URISyntaxException: "Exception",
  ParseException: "Exception",
  SQLException: "Exception",
  RuntimeException: "Exception",

  // IOException family
  FileNotFoundException: "IOException",
  EOFException: "IOException",
  UnsupportedEncodingException: "IOException",
  MalformedURLException: "IOException",
  UnknownHostException: "IOException",
  SocketException: "IOException",
  InterruptedIOException: "IOException",
  CharacterCodingException: "IOException",
  ObjectStreamException: "IOException",
  NotSerializableException: "ObjectStreamException",
  InvalidObjectException: "ObjectStreamException",

  // Reflection
  ClassNotFoundException: "ReflectiveOperationException",
  IllegalAccessException: "ReflectiveOperationException",
  InstantiationException: "ReflectiveOperationException",
  NoSuchMethodException: "ReflectiveOperationException",
  NoSuchFieldException: "ReflectiveOperationException",
  InvocationTargetException: "ReflectiveOperationException",

  // Unchecked exceptions (RuntimeException family)
  IllegalArgumentException: "RuntimeException",
  IllegalStateException: "RuntimeException",
  NullPointerException: "RuntimeException",
  IndexOutOfBoundsException: "RuntimeException",
  ClassCastException: "RuntimeException",
  ArithmeticException: "RuntimeException",
  UnsupportedOperationException: "RuntimeException",
  ConcurrentModificationException: "RuntimeException",
  NoSuchElementException: "RuntimeException",
  ArrayStoreException: "RuntimeException",
  NegativeArraySizeException: "RuntimeException",
  SecurityException: "RuntimeException",
  UncheckedIOException: "RuntimeException",
  NumberFormatException: "IllegalArgumentException",
  PatternSyntaxException: "IllegalArgumentException",
  IllegalCharsetNameException: "IllegalArgumentException",
  UnsupportedCharsetException: "IllegalArgumentException",
  ArrayIndexOutOfBoundsException: "IndexOutOfBoundsException",
  StringIndexOutOfBoundsException: "IndexOutOfBoundsException",
  CancellationException: "IllegalStateException",
  InputMismatchException: "NoSuchElementException",

  // Errors
  AssertionError: "Error",
  VirtualMachineError: "Error",
  OutOfMemoryError: "VirtualMachineError",
  StackOverflowError: "VirtualMachineError",
  LinkageError: "Error",
  ExceptionInInitializerError: "LinkageError",
  NoClassDefFoundError: "LinkageError",
}));

// JDK method NAME -> exceptions it is documented to throw.
// We only know the method's name, not its class (no type information), so e.g.
// "get" covers both Future.get and List.get. That over-approximates, which can
// only make the tool flag LESS, never more.
export const JDK_METHOD_THROWS: Map<string, string[]> = new Map(Object.entries({
  // Integer.parseInt, Long.parseLong, ...
  parseInt: ["NumberFormatException"],
  parseLong: ["NumberFormatException"],
  parseShort: ["NumberFormatException"],
  parseByte: ["NumberFormatException"],
  parseFloat: ["NumberFormatException"],
  parseDouble: ["NumberFormatException"],
  decode: ["NumberFormatException"],

  // Reflection
  forName: ["ClassNotFoundException"],
  newInstance: ["InstantiationException", "IllegalAccessException", "InvocationTargetException"],
  getMethod: ["NoSuchMethodException"],
  getDeclaredMethod: ["NoSuchMethodException"],
  getConstructor: ["NoSuchMethodException"],
  getDeclaredConstructor: ["NoSuchMethodException"],
  getField: ["NoSuchFieldException"],
  getDeclaredField: ["NoSuchFieldException"],
  invoke: ["IllegalAccessException", "InvocationTargetException", "IllegalArgumentException"],

  // Waiting / threads
  sleep: ["InterruptedException"],
  join: ["InterruptedException"],
  wait: ["InterruptedException"],
  await: ["InterruptedException", "TimeoutException"],
  awaitTermination: ["InterruptedException"],
  acquire: ["InterruptedException"],
  lockInterruptibly: ["InterruptedException"],
  invokeAll: ["InterruptedException"],
  // Future.get and List.get
  get: ["InterruptedException", "ExecutionException", "TimeoutException", "CancellationException", "IndexOutOfBoundsException"],

  // Collections / iterators / strings
  next: ["NoSuchElementException"],
  element: ["NoSuchElementException"],
  getFirst: ["NoSuchElementException"],
  getLast: ["NoSuchElementException"],
  removeFirst: ["NoSuchElementException"],
  removeLast: ["NoSuchElementException"],
  pop: ["NoSuchElementException"],
  remove: ["UnsupportedOperationException", "IllegalStateException", "IndexOutOfBoundsException"],
  add: ["UnsupportedOperationException", "IllegalStateException"],
  set: ["UnsupportedOperationException", "IndexOutOfBoundsException"],
  charAt: ["StringIndexOutOfBoundsException"],
  substring: ["StringIndexOutOfBoundsException"],
  subList: ["IndexOutOfBoundsException"],
  cast: ["ClassCastException"],

  // I/O streams, readers, writers, channels
  read: ["IOException"],
  readLine: ["IOException"],
  readFully: ["IOException", "EOFException"],
  readObject: ["IOException", "ClassNotFoundException"],
  write: ["IOException"],
  writeObject: ["IOException"],
  flush: ["IOException"],
  close: ["IOException"],
  skip: ["IOException"],
  available: ["IOException"],
  reset: ["IOException"],
  openStream: ["IOException"],
  openConnection: ["IOException"],
  getInputStream: ["IOException"],
  getOutputStream: ["IOException"],
  createNewFile: ["IOException"],
  getCanonicalPath: ["IOException"],
  getBytes: ["UnsupportedEncodingException"],
  toURI: ["URISyntaxException"],
  clone: ["CloneNotSupportedException"],
}));

// JDK constructors: `new X(...)` -> exceptions it is documented to throw.
export const JDK_CONSTRUCTOR_THROWS: Map<string, string[]> = new Map(Object.entries({
  FileInputStream: ["FileNotFoundException"],
  FileOutputStream: ["FileNotFoundException"],
  FileReader: ["FileNotFoundException"],
  FileWriter: ["IOException"],
  RandomAccessFile: ["FileNotFoundException"],
  PrintStream: ["FileNotFoundException", "UnsupportedEncodingException"],
  PrintWriter: ["FileNotFoundException", "UnsupportedEncodingException"],
  ObjectInputStream: ["IOException"],
  ObjectOutputStream: ["IOException"],
  InputStreamReader: ["UnsupportedEncodingException"],
  OutputStreamWriter: ["UnsupportedEncodingException"],
  String: ["UnsupportedEncodingException"],
  URL: ["MalformedURLException"],
  URI: ["URISyntaxException"],
  Socket: ["IOException", "UnknownHostException"],
  ServerSocket: ["IOException"],
}));
