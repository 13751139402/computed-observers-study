import { behavior } from "./behavior";
export { behavior } from "./behavior";
export function ComponentWithComputed(options) {
    if (!Array.isArray(options.behaviors)) {
        options.behaviors = [];
    }
    options.behaviors.unshift(behavior);
    return Component(options);
}
export function BehaviorWithComputed(options) {
    if (!Array.isArray(options.behaviors)) {
        options.behaviors = [];
    }
    options.behaviors.unshift(behavior);
    return Behavior(options);
}
var DataTracerMode1;
export { DataTracerMode1 as DataTracerMode,  };
(function(DataTracerMode) {
    DataTracerMode[DataTracerMode["Auto"] = 0] = "Auto";
    DataTracerMode[DataTracerMode["Proxy"] = 1] = "Proxy";
    DataTracerMode[DataTracerMode["DefineProperty"] = 2] = "DefineProperty";
})(DataTracerMode1 || (DataTracerMode1 = {
}));
var currentDataTracerMode = DataTracerMode1.Auto;
export var getCurrentDataTracerMode = function() {
    return currentDataTracerMode;
};
export var setCurrentDataTracerMode = function(mode) {
    currentDataTracerMode = mode;
};
