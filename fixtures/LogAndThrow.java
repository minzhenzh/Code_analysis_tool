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

    // FLAG (decided in Stage 3): printing to stderr then rethrowing. The paper does not say whether
    // System.err.println is a "logging call"; this tool counts console printing (System.out/err
    // print/println/printf and e.printStackTrace()) as logging, because it still "logs some information".
    void e() throws IOException {
        try {
            read();
        } catch (IOException e) {
            System.err.println("read failed");
            throw e;
        }
    }

    // ---- Quiz variants (added in Stage 3) ----

    // FLAG: java.util.logging style (what Guava uses): object `logger`, method `log`
    void julLogger() {
        try {
            close();
        } catch (IOException e) {
            logger.log(Level.WARNING, "close failed", e);
            throw new RuntimeException(e);
        }
    }

    // FLAG: the throw is nested inside an `if`, but it is still inside the catch body.
    // The rule is "the body CONTAINS a throw" (anywhere inside), not "a direct child is a throw".
    // When strict is true, this handler logs AND propagates.
    void conditionalThrow(boolean strict) throws IOException {
        try {
            read();
        } catch (IOException e) {
            LOG.error("read failed", e);
            if (strict) {
                throw e;
            }
        }
    }

    // NO FLAG: failures.add(e) is a method call but not a logging call
    // (object "failures" is not a logger, "add" is not a logging method). Only throws.
    void notALogCall() {
        try {
            read();
        } catch (IOException e) {
            failures.add(e);
            throw new IllegalStateException(e.getMessage());
        }
    }

    // ---- Added in Stage 5 (pattern found in Guava's Closeables.close and Flushables.flush) ----

    // NO FLAG: the handler logs OR throws, never both. The log call and the throw are in
    // opposite branches of the same if/else, so no run of this handler does both.
    void eitherLogOrThrow(boolean swallow) throws IOException {
        try {
            read();
        } catch (IOException e) {
            if (swallow) {
                LOG.warn("read failed", e);
            } else {
                throw e;
            }
        }
    }

    void read() throws IOException { }
}
