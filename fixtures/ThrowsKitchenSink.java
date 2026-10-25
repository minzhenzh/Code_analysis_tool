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
}

interface Fetcher {
    // FLAG: abstract/interface methods (no body) still declare throws
    void fetch() throws IOException, InterruptedException;
}
