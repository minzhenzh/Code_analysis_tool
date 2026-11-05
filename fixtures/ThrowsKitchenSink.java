// Fixture: Throws Kitchen Sink
// Definition (paper, Table I): the throws clause propagates multiple exceptions.
// Rule used here: FLAG any method or constructor whose `throws` clause lists 2 or more exception types.
//
// Java notes:
// - `throws X, Y` after a method's parameter list declares which exceptions the method may throw.
// - These files only need to PARSE, not compile, so missing imports are fine.

import java.io.IOException;
import java.sql.SQLException;

public class ThrowsKitchenSink {

    // FLAG: two exception types
    public void load() throws IOException, SQLException { }

    // FLAG: three exception types
    public void parse() throws IOException, ParseException, TimeoutException { }

    // FLAG: constructors can have throws clauses too
    public ThrowsKitchenSink() throws IOException, SQLException { }

    // NO FLAG: only one exception type
    public void save() throws IOException { }

    // NO FLAG: one generic type (this is a different anti-pattern, "Throws Generic")
    public void risky() throws Exception { }

    // NO FLAG: no throws clause at all
    public void close() { }

    // ---- Quiz variants (added in Stage 2) ----

    // NO FLAG: `catch (A | B e)` is a multi-catch (catches A or B). It is a catch clause,
    // not a throws clause, and this rule only looks at throws clauses.
    void multiCatch() {
        try {
            open();
        } catch (IOException | SQLException e) { }
    }

    // FLAG: fully qualified names are still just 2 types. The tool must count the types
    // in the clause, not every identifier inside them (java, io, IOException, ...).
    void qualified() throws java.io.IOException, java.sql.SQLException { }

    // NO FLAG: the throws clause declares only ONE type. The `throw` statement in the body
    // is not part of the throws clause (IllegalStateException is unchecked, so Java does not
    // require it to be declared).
    void throwInBody() throws IOException {
        throw new IllegalStateException("bad");
    }
}

interface Fetcher {
    // FLAG: abstract/interface methods (no body) still declare throws
    void fetch() throws IOException, InterruptedException;
}
