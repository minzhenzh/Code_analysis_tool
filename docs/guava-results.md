# Stage 5: Results on Guava v19.0 vs. the paper

## Setup

- Subject: Guava **v19.0** (git tag `v19.0`, commit `daa84b6`), cloned into `subjects/guava-19.0/` (not in git).
- Scope: the **`guava/` module only** (main library source, 469 `.java` files). Tests (`guava-tests`,
  `guava-testlib`) and the GWT copy (`guava-gwt`) are excluded. This matches the paper's scope: our
  totals for `guava/` agree with the paper's Table II (509 throws, 317 catch), while any larger scope
  is far off (e.g. the whole repository has 3,635 catch blocks and 8,116 throws clauses).
- Command (about 0.6 s):

  ```bash
  git clone --depth 1 --branch v19.0 https://github.com/google/guava.git subjects/guava-19.0
  node dist/cli.js subjects/guava-19.0/guava      # reports in out/guava/
  ```

## Results

| | Paper (Tables II–IV) | This tool | Match? |
|---|---:|---:|---|
| # throws clauses | 509 | **509** | exact |
| # catch blocks | 317 | **320** | +3 (≈1%) |
| **Throws Kitchen Sink** (% of throws) | 11.79% | **11.79%** (60/509) | exact |
| **Log and Throw** (% of catch) | 0.00% | **0.31%** (1/320) | close |
| **Unreachable Handler** (% of catch) | 37.22% (≈118/317) | **11.56%** (37/320) | much lower |

## Why the numbers agree or differ

### Throws Kitchen Sink: exact match

The rule is purely syntactic (count the types in each `throws` clause), so a syntax tree is all that is
needed and tree-sitter sees exactly what Eclipse JDT sees. Both the denominator (509) and the count (60)
match. This also confirms that we analyze the same files as the paper.

### Catch blocks: 320 vs. 317

The 3 extra catch blocks most likely come from a small difference in what the two tools count (the
paper's tool is not available to check). It changes the percentages by less than 1%.

### Log and Throw: 1 vs. 0

The first run (rule: the catch body *contains* a log call and a throw) found 3:

| Finding | What the code does | Verdict |
|---|---|---|
| `io/Closeables.java:80` | `if (swallow) logger.log(...); else throw e;` | **false positive**: log and throw are in *opposite branches*, the handler never does both |
| `io/Flushables.java:57` | same if/else pattern | **false positive** (same reason) |
| `util/concurrent/ListenerCallQueue.java:87` | `logger.log(Level.SEVERE, ...); throw e;` | **true positive**: logs, then rethrows |

- The two false positives came from the first version of the rule, which did not check whether both can
  happen on the same path. The rule was then refined: a log call and a throw in **opposite branches of the
  same `if`/`else`** are not flagged (fixture example `eitherLogOrThrow`). This removed both false
  positives: **1/320 = 0.31%**, and the remaining finding is a true positive.
- The remaining true positive was apparently not reported by the paper (0.00%), even though the code
  clearly logs and rethrows. Possibly the paper's tool did not recognise `java.util.logging`'s
  `logger.log(Level, ...)` form, but this cannot be checked.
- Either way, both tools agree that Log and Throw is **rare** in Guava (≤ 1%).

### Unreachable Handler: 11.56% vs. 37.22%

Without type information this anti-pattern depends entirely on how the "possible exceptions" of a try
block are estimated. To see which of our approximations matters, the detector was re-run with parts of
it switched off (sensitivity analysis, `guava/` module):

| Variant | Flagged | % |
|---|---:|---:|
| Our tool as designed | 37 / 320 | 11.56% |
| without exceptions from operations (casts, `.`, `/`, `[]`, `assert`) | 62 / 320 | 19.38% |
| without the hand-written JDK method/constructor table | 60 / 320 | 18.75% |
| also flag `catch (Exception/Throwable)` when nothing can be thrown | 42 / 320 | 13.13% |
| no operations + generic catches not exempt | 74 / 320 | 23.13% |
| no operations + no JDK table + generic not exempt | 102 / 320 | 31.88% |

Explanations for the gap:

1. **Exceptions from operations.** Guava has 25 `catch (ClassCastException)` and 13
   `catch (NullPointerException)` blocks, e.g. around a cast or a call on a possibly-null object. These
   exceptions are never declared or documented by a method; they come from the cast or the `.` itself.
   Our tool models this and counts those catches as reachable (correctly). A tool that only collects
   documented/declared exceptions (as the paper describes: Javadoc, library documentation, `throw`
   statements, bindings) would flag them. Turning this modelling off moves us from 11.6% to 19.4%.
2. **Name-only matching makes us flag less.** A call `x.get()` collects the exceptions of *every* method
   named `get` in the repo and the JDK table. With type bindings, the paper's tool knows exactly which
   `get` is called, so it collects fewer exceptions and flags more.
3. **Our JDK table is small; real library documentation is large.** This works in the opposite direction
   (it makes us flag more), and it explains most of our own false positives (below).
4. With most approximations switched off, we reach 31.9%, close to the paper's 37.2%. This suggests the
   paper's higher number mostly reflects which exceptions its analysis could *see*, not a difference in
   Guava itself.

**Manual check of our 37 findings.** Most of them are *false positives* caused by the limitations above,
for example:

| Finding | Why it is actually reachable | Cause |
|---|---|---|
| `collect/Collections2.java:111` `catch (ClassCastException)` around `collection.contains(o)` | `Collection.contains` is documented to throw ClassCastException | JDK table does not list `contains` |
| `collect/Cut.java:100` `catch (ClassCastException)` around `compareTo(that)` | `Comparable.compareTo` throws ClassCastException (the code comment even says so) | JDK table does not list `compareTo` |
| `hash/BloomFilter.java:354` `catch (IllegalArgumentException)` around `new BloomFilter(...)` | the constructor calls `checkArgument(...)`, which throws it | one level only: we do not follow calls inside the constructor |
| `util/concurrent/Futures.java:1769` `catch (Error)` | any call can fail with an Error (e.g. OutOfMemoryError) | Errors are not modelled as possible everywhere |
| `hash/MessageDigestHashFunction.java:78` `catch (NoSuchAlgorithmException)` around `MessageDigest.getInstance` | documented by the JDK | JDK table does not list `getInstance` |

So, like the paper's number, ours is an **approximation**: our tool under-reports in some places (name-only
matching, operations) and over-reports in others (missing library documentation, one-level analysis).
Precisely detecting this anti-pattern needs type bindings and complete library documentation, which
is exactly why the paper used Eclipse JDT.

## Summary

- The tool analyzes the same 469 files as the paper (509 throws clauses, exact).
- **Throws Kitchen Sink** reproduces the paper exactly (11.79%).
- **Log and Throw** agrees that the anti-pattern is rare (0.31% vs. 0.00%). Two if/else false positives
  found in the first run were fixed by refining the rule; the 1 remaining finding is a real Log and Throw.
- **Unreachable Handler** is lower (11.56% vs. 37.22%). The sensitivity analysis shows the difference
  comes from how possible exceptions are estimated; with fewer exception sources our tool reaches 31.88%.
