// Fixture: Log and Throw
// Definition (paper, Table I): the handler logs some information and propagates the exception.
// Rule used here: FLAG a catch block whose body contains BOTH a logging call AND a throw statement.
//
// Java notes:
// - `catch (IOException e)` only catches IOException (and its subclasses); `e` is the caught exception.
// - `throw e;` rethrows the same exception; `throw new X(e);` wraps it in a new one.
// - Real projects log with objects usually named LOG / LOGGER / logger (e.g., LOG.error(...)).

import java.io.IOException;

public class LogAndThrow {

    // FLAG: logs, then rethrows the same exception
    void a() throws IOException {
        try {
            read();
        } catch (IOException e) {
            LOG.error("read failed", e);
            throw e;
        }
    }

    // FLAG: logs, then throws a new exception wrapping the original
    void b() {
        try {
            read();
        } catch (IOException e) {
            LOGGER.warn("read failed: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // NO FLAG: only logs, does not rethrow ("Dummy Handler", a different anti-pattern)
    void c() {
        try {
            read();
        } catch (IOException e) {
            LOG.error("read failed", e);
        }
    }

    // NO FLAG: only rethrows, no logging
    void d() throws IOException {
        try {
            read();
        } catch (IOException e) {
            throw e;
        }
    }

    // DECIDE: printing to stderr then rethrowing. Is System.err.println a "logging call"?
    // The paper does not say. Pick a rule, apply it consistently, and state it in your README/report.
    void e() throws IOException {
        try {
            read();
        } catch (IOException e) {
            System.err.println("read failed");
            throw e;
        }
    }

    void read() throws IOException { }
}
