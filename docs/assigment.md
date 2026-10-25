# CIS*6650 Assignment 2: Code Analysis Tool Development

## Course
CIS*6650 Topics in Computer Science I (Data-Driven Software Engineering), University of Guelph, Fall 2026.
Instructor: Dr. Lizhi Liao.

## Student
Minzhen Zhang. This is an individual assignment: I work alone and implement only my own anti-patterns.

## Task
Develop a code analysis tool that detects exception handling anti-patterns, based on:
G. B. de Pádua and W. Shang, "Studying the Prevalence of Exception Handling Anti-Patterns,"
ICPC 2017, pp. 328–331. doi:10.1109/ICPC.2017.1 (PDF in docs/).
https://ieeexplore.ieee.org/document/7961532

## Anti-pattern assignments for the whole class (from the course sign-up sheet)
| Group   | Anti-pattern                  | Assigned to                        |
|---------|-------------------------------|------------------------------------|
| Flow    | Over-catch                    | Saif Ur Rehman                     |
| Flow    | Over-catch and Abort          | Mohammadreza Zare, Saim Azfar      |
| Flow    | Unhandled Exceptions          | Yuvraj Gill                        |
| Flow    | **Unreachable Handler**       | **Minzhen Zhang**                  |
| Handler | Catch and Return Null         | Saif Ur Rehman                     |
| Handler | Destructive Wrapping          | Mohammadreza Zare                  |
| Handler | Ignoring InterruptedException | Yuvraj Gill                        |
| Handler | **Log and Throw**             | **Minzhen Zhang**                  |
| Handler | Nested Try                    | Saim Azfar                         |
| Handler | Throw within Finally          | Yuvraj Gill                        |
| Throws  | Throws Generic                | Mohammadreza Zare                  |
| Throws  | **Throws Kitchen Sink**       | **Saif Ur Rehman, Minzhen Zhang**  |

Only the three bolded anti-patterns assigned to me are in scope. Throws Kitchen Sink is also assigned
to Saif Ur Rehman, but we implement it independently.

## My anti-patterns (definitions from the paper, Table I)
| Group   | Anti-pattern        | Definition                                                                   |
|---------|---------------------|------------------------------------------------------------------------------|
| Flow    | Unreachable Handler | The handler does not catch any possible exception from the try block.        |
| Handler | Log and Throw       | The handler logs some information and propagates the exception.              |
| Throws  | Throws Kitchen Sink | The throws clause propagates multiple exceptions.                            |

Paper's reported prevalence for comparison (Table III: % of catch blocks; Table IV: % of throws clauses):
| Project            | Unreachable Handler | Log and Throw | Throws Kitchen Sink |
|--------------------|---------------------|---------------|---------------------|
| Guava v19.0        | 37.22%              | 0.00%         | 11.79%              |
| Apache ANT 1.9.7   | 6.94%               | 0.26%         | 6.54%               |
| Spring 4.3.2       | 25.51%              | 0.04%         | 8.21%               |

## Deliverables
- 2-page report in ACM format (PDF)
- Source code
- Executable
- Presentation slides
- Live demo of the tool in class
- File naming: the syllabus uses MinzhenZhang_Report.pdf / MinzhenZhang_Slides

## Grading (15% of final grade)
- Presentation/demo: 5%
- Report and source code: 10%

## Deadlines
- Submission: Sunday, Nov 8, 2026, 11:59 PM ET. Late submissions get 0.
- Demo: Week 10 "Assignment presentations" (tentatively Tuesday, Nov 17, 2026).

## Instructor clarifications
- A functional prototype demonstrating core functionality is sufficient.
- A polished UI, extensive error handling, and production-level optimization are NOT required.
