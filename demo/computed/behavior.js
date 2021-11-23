/* eslint-disable @typescript-eslint/ban-types */
import rfdc from "rfdc";
import deepEqual from "fast-deep-equal";
import * as dataPath from "./data-path";
import * as dataTracer from "./data-tracer";

function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) {
        for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) {
            arr2[i] = arr[i];
        }
        return arr2;
    }
}

function _defineProperty(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}

function _iterableToArray(iter) {
    if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
}

function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance");
}

function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
}
var deepClone = rfdc({
    proto: true
});
var computedWatchDefIdInc = 0;
export var behavior = Behavior({
    lifetimes: {
        // 钩子流出:definitionFilter->created->attached definitionFilter先添加了data _computedWatchInit的observer
        // created触发时init data fields, attached
        // attached触发时handling watch
        attached: function () {
            this.setData({
                _computedWatchInit: "attached"
            });
        },
        created: function () {
            this.setData({
                _computedWatchInit: "created"
            });
        }
    },
    definitionFilter: function (defFields) {
        var computedDef = defFields.computed;
        var watchDef = defFields.watch;
        var observersItems = [];
        var computedWatchDefId = computedWatchDefIdInc++;
        observersItems.push({
            fields: "_computedWatchInit",
            observer: function () {
                var status = this.data._computedWatchInit;
                if (status === "created") {
                    // init data fields
                    var computedWatchInfo = {
                        computedUpdaters: [],
                        computedRelatedPathValues: {},
                        watchCurVal: {},
                        _triggerFromComputedAttached: {}
                    };
                    if (!this._computedWatchInfo) this._computedWatchInfo = {};
                    this._computedWatchInfo[computedWatchDefId] = computedWatchInfo;
                    // handling watch
                    // 1. push to initFuncs
                    if (watchDef) {
                        var _this = this;
                        Object.keys(watchDef).forEach(function (watchPath) {
                            var _this2 = _this;
                            var paths = dataPath.parseMultiDataPaths(watchPath);
                            // record the original value of watch targets
                            var curVal = paths.map(function (param) {
                                var path = param.path,
                                    options = param.options;
                                var val = dataPath.getDataOnPath(_this2.data, path);
                                return options.deepCmp ? deepClone(val) : val;
                            });
                            computedWatchInfo.watchCurVal[watchPath] = curVal;
                        });
                    }
                } else if (status === "attached") {
                    // handling computed
                    // 1. push to initFuncs
                    // 2. push to computedUpdaters
                    var computedWatchInfo1 = this._computedWatchInfo[computedWatchDefId];
                    if (computedDef) {
                        var _this1 = this;
                        Object.keys(computedDef).forEach(function (targetField) {
                            console.log("targetField", targetField);
                            var _this = _this1,
                                _this3 = _this1;
                            var updateMethod = computedDef[targetField];
                            var relatedPathValuesOnDef = [];
                            // 触发coomputed函数 dataTracer使用proxy做数据跟踪
                            // dataTracer用来追踪computed数据路径
                            var val1 = updateMethod(dataTracer.create(_this1.data, relatedPathValuesOnDef));
                            console.log("val1val1:", val1, "relatedPathValuesOnDef:", relatedPathValuesOnDef);
                            var pathValues = relatedPathValuesOnDef.map(function (param) {
                                var path = param.path;
                                return {
                                    path: path,
                                    value: dataPath.getDataOnPath(_this.data, path) // 从path中拿到值
                                };
                            });
                            // here we can do small setDatas
                            // because observer handlers will force grouping small setDatas together
                            // computed被触发计算出值后,丢入setData渲染页面
                            _this1.setData(_defineProperty({}, targetField, dataTracer.unwrap(val1)));
                            computedWatchInfo1._triggerFromComputedAttached[targetField] = true;
                            computedWatchInfo1.computedRelatedPathValues[targetField] = pathValues;
                            // will be invoked when setData is called
                            // 当setData被调用时会触发
                            var updateValueAndRelatedPaths = function () {
                                var oldPathValues = computedWatchInfo1.computedRelatedPathValues[targetField];
                                var needUpdate = false;
                                // check whether its dependency updated
                                // 检查其依赖项是否已更新
                                // 之前init时保存了computed中依赖的data的path和oldValue
                                // 当computed触发时通过path找到newValue进行新旧对比,如果不同则需要更新,进而调用computed计算新结果
                                for (var i = 0; i < oldPathValues.length; i++) {
                                    var _i = oldPathValues[i],
                                        path = _i.path,
                                        oldVal = _i.value;
                                    var curVal = dataPath.getDataOnPath(_this3.data, path);
                                    if (oldVal !== curVal) {
                                        needUpdate = true;
                                        break;
                                    }
                                }
                                if (!needUpdate) return false;
                                var relatedPathValues = [];
                                var val = updateMethod(dataTracer.create(_this3.data, relatedPathValues));
                                _this3.setData(_defineProperty({}, targetField, dataTracer.unwrap(val)));
                                computedWatchInfo1.computedRelatedPathValues[targetField] = relatedPathValues;
                                return true;
                            };
                            computedWatchInfo1.computedUpdaters.push(updateValueAndRelatedPaths);
                        });
                    }
                }
            }
        });
        if (computedDef) {
            observersItems.push({
                fields: "**",
                observer: function () {
                    console.log("setData,computedDef observer invoke");
                    if (!this._computedWatchInfo) return;
                    var computedWatchInfo = this._computedWatchInfo[computedWatchDefId];
                    if (!computedWatchInfo) return;
                    var changed;
                    do {
                        var _this = this;
                        changed = computedWatchInfo.computedUpdaters.some(function (func) {
                            return func.call(_this);
                        });
                    } while (changed)
                }
            });
        }
        if (watchDef) {
            Object.keys(watchDef).forEach(function (watchPath) {
                var paths = dataPath.parseMultiDataPaths(watchPath);
                observersItems.push({
                    fields: watchPath,
                    observer: function () {
                        var _this = this;
                        if (!this._computedWatchInfo) return;
                        var computedWatchInfo = this._computedWatchInfo[computedWatchDefId];
                        if (!computedWatchInfo) return;
                        // (issue #58) ignore watch func when trigger by computed attached
                        if (Object.keys(computedWatchInfo._triggerFromComputedAttached).length) {
                            var pathsMap = {};
                            paths.forEach(function (path) {
                                return pathsMap[path.path[0]] = true;
                            });
                            for (var computedVal in computedWatchInfo._triggerFromComputedAttached) {
                                if (computedWatchInfo._triggerFromComputedAttached.hasOwnProperty(computedVal)) {
                                    if (pathsMap[computedVal] && computedWatchInfo._triggerFromComputedAttached[computedVal]) {
                                        computedWatchInfo._triggerFromComputedAttached[computedVal] = false;
                                        return;
                                    }
                                }
                            }
                        }
                        var oldVal = computedWatchInfo.watchCurVal[watchPath];
                        // get new watching field value
                        var originalCurValWithOptions = paths.map(function (param) {
                            var path = param.path,
                                options = param.options;
                            var val = dataPath.getDataOnPath(_this.data, path);
                            return {
                                val: val,
                                options: options
                            };
                        });
                        var curVal = originalCurValWithOptions.map(function (param) {
                            var val = param.val,
                                options = param.options;
                            return options.deepCmp ? deepClone(val) : val;
                        });
                        computedWatchInfo.watchCurVal[watchPath] = curVal;
                        // compare
                        var changed = false;
                        for (var i = 0; i < curVal.length; i++) {
                            var options1 = paths[i].options;
                            var deepCmp = options1.deepCmp;
                            if (deepCmp ? !deepEqual(oldVal[i], curVal[i]) : oldVal[i] !== curVal[i]) {
                                changed = true;
                                break;
                            }
                        }
                        // if changed, update
                        if (changed) {
                            watchDef[watchPath].apply(this, originalCurValWithOptions.map(function (param) {
                                var val = param.val;
                                return val;
                            }));
                        }
                    }
                });
            });
        }
        if (typeof defFields.observers !== "object") {
            defFields.observers = {};
        }
        if (Array.isArray(defFields.observers)) {
            var _observers;
            (_observers = defFields.observers).push.apply(_observers, _toConsumableArray(observersItems));
        } else {
            observersItems.forEach(function (item) {
                // defFields.observers[item.fields] = item.observer
                // observers:数据监听器可以用于监听和响应任何属性和数据字段的变化
                var f = defFields.observers[item.fields];
                if (!f) {
                    defFields.observers[item.fields] = item.observer;
                } else {
                    defFields.observers[item.fields] = function () {
                        item.observer.call(this);
                        f.call(this);
                    };
                }
            });
        }
    }
});