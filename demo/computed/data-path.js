var WHITE_SPACE_CHAR_REGEXP = /^\s/;
var throwParsingError = function throwParsingError(path, index) {
    throw new Error('Parsing data path "' + path + '" failed at char "' + path[index] + '" (index ' + index + ")");
};
var parseArrIndex = function parseArrIndex(path, state) {
    var startIndex = state.index;
    while(state.index < state.length){
        var ch = path[state.index];
        if (/^[0-9]/.test(ch)) {
            state.index++;
            continue;
        }
        break;
    }
    if (startIndex === state.index) {
        throwParsingError(path, state.index);
    }
    return parseInt(path.slice(startIndex, state.index), 10);
};
var parseIdent = function parseIdent(path, state) {
    var startIndex = state.index;
    var ch = path[startIndex];
    if (/^[_a-zA-Z$]/.test(ch)) {
        state.index++;
        while(state.index < state.length){
            var ch1 = path[state.index];
            if (/^[_a-zA-Z0-9$]/.test(ch1)) {
                state.index++;
                continue;
            }
            break;
        }
    } else {
        throwParsingError(path, state.index);
    }
    return path.slice(startIndex, state.index);
};
var parseSinglePath = function parseSinglePath(path, state) {
    var paths = [
        parseIdent(path, state)
    ];
    var options = {
        deepCmp: false
    };
    while(state.index < state.length){
        var ch = path[state.index];
        if (ch === "[") {
            state.index++;
            paths.push(parseArrIndex(path, state));
            var nextCh = path[state.index];
            if (nextCh !== "]") throwParsingError(path, state.index);
            state.index++;
        } else if (ch === ".") {
            state.index++;
            var ch2 = path[state.index];
            if (ch2 === "*") {
                state.index++;
                var ch3 = path[state.index];
                if (ch3 === "*") {
                    state.index++;
                    options.deepCmp = true;
                    break;
                }
                throwParsingError(path, state.index);
            }
            paths.push(parseIdent(path, state));
        } else {
            break;
        }
    }
    return {
        path: paths,
        options: options
    };
};
var parseMultiPaths = function parseMultiPaths(path, state) {
    while(WHITE_SPACE_CHAR_REGEXP.test(path[state.index])){
        state.index++;
    }
    var ret = [
        parseSinglePath(path, state)
    ];
    var splitted = false;
    while(state.index < state.length){
        var ch = path[state.index];
        if (WHITE_SPACE_CHAR_REGEXP.test(ch)) {
            state.index++;
        } else if (ch === ",") {
            splitted = true;
            state.index++;
        } else if (splitted) {
            splitted = false;
            ret.push(parseSinglePath(path, state));
        } else {
            throwParsingError(path, state.index);
        }
    }
    return ret;
};
var parseEOF = function parseEOF(path, state) {
    if (state.index < state.length) throwParsingError(path, state.index);
};
export function parseMultiDataPaths(path) {
    var state = {
        length: path.length,
        index: 0
    };
    var ret = parseMultiPaths(path, state);
    parseEOF(path, state);
    return ret;
}
export var getDataOnPath = function getDataOnPath(data, path) {
    var ret = data;
    path.forEach(function(s) {
        if (typeof ret !== "object" || ret === null) ret = undefined;
        else ret = ret[s];
    });
    return ret;
};
