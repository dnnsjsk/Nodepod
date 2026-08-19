/**
 * Dependency-free Bash grammar front-end.
 *
 * The legacy parser remains exported as `parse()` for consumers that use the
 * small AST directly. NodepodShell uses this parser for execution so quote
 * information is preserved until the expansion phase.
 */
export interface BashSyntaxError extends Error {
    readonly offset: number;
    readonly line: number;
    readonly column: number;
}
export type BashRedirect = {
    op: string;
    fd?: number;
    target?: string;
    heredoc?: {
        delimiter: string;
        stripTabs: boolean;
        body: string;
        expand?: boolean;
    };
};
export interface BashSimpleCommand {
    kind: "simple";
    assignments: string[];
    words: string[];
    redirects: BashRedirect[];
}
export interface BashGroupCommand {
    kind: "group" | "subshell";
    body: BashList;
}
export interface BashIfCommand {
    kind: "if";
    branches: Array<{
        condition: BashList;
        body: BashList;
    }>;
    elseBody?: BashList;
}
export interface BashLoopCommand {
    kind: "while" | "until";
    condition: BashList;
    body: BashList;
}
export interface BashForCommand {
    kind: "for";
    variable: string;
    words: string[] | null;
    body: BashList;
}
export interface BashArithmeticForCommand {
    kind: "arithmetic-for";
    init: string;
    condition: string;
    update: string;
    body: BashList;
}
export interface BashCaseClause {
    patterns: string[];
    body: BashList;
    terminator: ";;" | ";&" | ";;&" | null;
}
export interface BashCaseCommand {
    kind: "case";
    word: string;
    clauses: BashCaseClause[];
}
export interface BashSelectCommand {
    kind: "select";
    variable: string;
    words: string[];
    body: BashList;
}
export interface BashConditionalCommand {
    kind: "conditional";
    words: string[];
}
export interface BashArithmeticCommand {
    kind: "arithmetic";
    expression: string;
}
export interface BashCoprocCommand {
    kind: "coproc";
    name: string;
    body: BashCommand;
}
export interface BashFunctionCommand {
    kind: "function";
    name: string;
    body: BashCommand;
}
export type BashCommand = BashSimpleCommand | BashGroupCommand | BashIfCommand | BashLoopCommand | BashForCommand | BashArithmeticForCommand | BashCaseCommand | BashSelectCommand | BashConditionalCommand | BashArithmeticCommand | BashCoprocCommand | BashFunctionCommand;
export interface BashPipeline {
    kind: "pipeline";
    commands: BashCommand[];
    negated: boolean;
    background: boolean;
}
export interface BashAndOr {
    kind: "and-or";
    first: BashPipeline;
    rest: Array<{
        op: "&&" | "||";
        pipeline: BashPipeline;
    }>;
}
export interface BashListEntry {
    command: BashAndOr;
    separator?: ";" | "&" | "newline";
}
export interface BashList {
    kind: "list";
    entries: BashListEntry[];
}
export declare function parseBash(source: string, maxDepth?: number): BashList;
