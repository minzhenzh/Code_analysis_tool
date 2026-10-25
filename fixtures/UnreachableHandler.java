// Fixture: Unreachable Handler
// Definition (paper, Table I): the handler does not catch any possible exception from the try block.
// Rule used here: FLAG a catch block if nothing in its try block can throw the caught type
// (or a subclass of it).
//
// Java notes:
// - Exceptions extending RuntimeException are "unchecked": Java does not force you to declare them.
//   The compiler REJECTS a catch for a checked exception the try block cannot throw, so real
//   unreachable handlers in compiling code usually involve unchecked exceptions.
// - A catch for a superclass also catches its subclasses (FileNotFoundException extends IOException).
// - `catch (Exception e)` catches almost everything, including all runtime exceptions.

import java.io.FileNotFoundException;
import java.io.IOException;

public class UnreachableHandler {

    // FLAG: adding two ints cannot throw NumberFormatException
    void a(int x, int y) {
        try {
            int sum = x + y;
        } catch (NumberFormatException e) { }
    }

    // NO FLAG: Integer.parseInt (a JDK method) throws NumberFormatException
    void b(String s) {
        try {
            Integer.parseInt(s);
        } catch (NumberFormatException e) { }
    }

    // NO FLAG: the try block explicitly throws the caught type
    void c(boolean bad) {
        try {
            if (bad) throw new IllegalStateException("bad");
        } catch (IllegalStateException e) { }
    }

    // NO FLAG: openFile() declares FileNotFoundException, a SUBCLASS of IOException,
    // so catch (IOException) is reachable
    void d() {
        try {
            openFile();
        } catch (IOException e) { }
    }

    // NO FLAG: generic catch is always considered reachable
    void e() {
        try {
            int y = 1;
        } catch (Exception e) { }
    }

    // FLAG: ConfigException (declared below in this file) is never thrown in the try block
    void f() {
        try {
            int z = 2;
        } catch (ConfigException e) { }
    }

    // NO FLAG: loadConfig() (declared in this file) throws ConfigException
    void g() {
        try {
            loadConfig();
        } catch (ConfigException e) { }
    }

    void openFile() throws FileNotFoundException { }

    void loadConfig() {
        throw new ConfigException();
    }
}

// A project-defined unchecked exception, so the tool must read `extends` declarations
class ConfigException extends RuntimeException { }
