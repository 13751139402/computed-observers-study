/* eslint-disable @typescript-eslint/ban-types */
import rfdc from "rfdc";
import deepEqual from "fast-deep-equal";
import * as dataPath from "./data-path";
import * as dataTracer from "./data-tracer";

const deepClone = rfdc({ proto: true });

interface BehaviorExtend {
  // original 原先的
  data: Record<string, any>;
  setData(d: Record<string, any>): void;
  _computedWatchInfo: Record<string, ComputedWatchInfo>;
}

interface ObserversItem {
  fields: string;
  observer(): void;
}

interface ComputedWatchInfo {
  computedUpdaters: Array<any>;
  computedRelatedPathValues: Record<string, any>;
  watchCurVal: Record<string, any>;
  _triggerFromComputedAttached: Record<string, boolean>;
}

let computedWatchDefIdInc = 0;

export const behavior = Behavior({
  // 钩子流出:definitionFilter->created->attached definitionFilter先添加了data _computedWatchInit的observer
  // created触发时init data fields, attached
  // attached触发时handling watch
  lifetimes: {
    attached(this: BehaviorExtend) {
      this.setData({
        _computedWatchInit: "attached",
      });
    },
    created(this: BehaviorExtend) {
      this.setData({
        _computedWatchInit: "created",
      });
    },
  },

  definitionFilter(defFields: any & BehaviorExtend) {
    const computedDef = defFields.computed;
    const watchDef = defFields.watch;
    const observersItems: ObserversItem[] = [];
    const computedWatchDefId = computedWatchDefIdInc++;
    observersItems.push({
      fields: "_computedWatchInit",
      observer(this: BehaviorExtend) {
        const status = this.data._computedWatchInit;
        if (status === "created") {
          // init data fields
          const computedWatchInfo = {
            computedUpdaters: [],
            computedRelatedPathValues: {},
            watchCurVal: {},
            _triggerFromComputedAttached: {},
          };
          if (!this._computedWatchInfo) this._computedWatchInfo = {};
          this._computedWatchInfo[computedWatchDefId] = computedWatchInfo;
          // handling watch
          // 1. push to initFuncs
          if (watchDef) {
            Object.keys(watchDef).forEach((watchPath) => {
              const paths = dataPath.parseMultiDataPaths(watchPath);
              // record the original value of watch targets
              const curVal = paths.map(({ path, options }) => {
                const val = dataPath.getDataOnPath(this.data, path);
                return options.deepCmp ? deepClone(val) : val;
              });
              computedWatchInfo.watchCurVal[watchPath] = curVal;
            });
          }
        } else if (status === "attached") {
          // handling computed
          // 1. push to initFuncs
          // 2. push to computedUpdaters
          // 触发coomputed函数 dataTracer使用proxy做数据跟踪
          // dataTracer用来追踪computed数据路径
          const computedWatchInfo = this._computedWatchInfo[computedWatchDefId];
          if (computedDef) {
            Object.keys(computedDef).forEach((targetField) => {
              const updateMethod = computedDef[targetField];
              const relatedPathValuesOnDef = [];
              const val = updateMethod(
                dataTracer.create(this.data, relatedPathValuesOnDef)
              );

              const pathValues = relatedPathValuesOnDef.map(({ path }) => ({
                path,
                value: dataPath.getDataOnPath(this.data, path),
              }));

              // here we can do small setDatas
              // because observer handlers will force grouping small setDatas together
              // computed被触发计算出值后,丢入setData渲染页面
              this.setData({
                [targetField]: dataTracer.unwrap(val),
              });
              computedWatchInfo._triggerFromComputedAttached[targetField] =
                true;
              computedWatchInfo.computedRelatedPathValues[targetField] =
                pathValues;

              // will be invoked when setData is called
              // 当setData被调用时会触发
              const updateValueAndRelatedPaths = () => {
                const oldPathValues =
                  computedWatchInfo.computedRelatedPathValues[targetField];
                let needUpdate = false;
                // check whether its dependency updated
                // 检查其依赖项是否已更新
                // 之前init时保存了computed中依赖的data的path和oldValue
                // 当computed触发时通过path找到newValue进行新旧对比,如果不同则需要更新,进而调用computed计算新结果
                for (let i = 0; i < oldPathValues.length; i++) {
                  const { path, value: oldVal } = oldPathValues[i];
                  const curVal = dataPath.getDataOnPath(this.data, path);
                  if (oldVal !== curVal) {
                    needUpdate = true;
                    break;
                  }
                }
                if (!needUpdate) return false;

                const relatedPathValues = [];
                const val = updateMethod(
                  dataTracer.create(this.data, relatedPathValues)
                );
                this.setData({
                  [targetField]: dataTracer.unwrap(val),
                });
                computedWatchInfo.computedRelatedPathValues[targetField] =
                  relatedPathValues;
                return true;
              };
              computedWatchInfo.computedUpdaters.push(
                updateValueAndRelatedPaths
              );
            });
          }
        }
      },
    });

    if (computedDef) {
      observersItems.push({
        fields: "**",
        observer(this: BehaviorExtend) {
          if (!this._computedWatchInfo) return;
          const computedWatchInfo = this._computedWatchInfo[computedWatchDefId];
          if (!computedWatchInfo) return;

          let changed: boolean;
          do {
            changed = computedWatchInfo.computedUpdaters.some((func) =>
              func.call(this)
            );
          } while (changed);
        },
      });
    }

    if (watchDef) {
      Object.keys(watchDef).forEach((watchPath) => {
        const paths = dataPath.parseMultiDataPaths(watchPath);
        observersItems.push({
          fields: watchPath,
          observer(this: BehaviorExtend) {
            if (!this._computedWatchInfo) return;
            const computedWatchInfo =
              this._computedWatchInfo[computedWatchDefId];
            if (!computedWatchInfo) return;
            // (issue #58) ignore watch func when trigger by computed attached
            if (
              Object.keys(computedWatchInfo._triggerFromComputedAttached).length
            ) {
              const pathsMap: Record<string, boolean> = {};
              paths.forEach((path) => (pathsMap[path.path[0]] = true));
              for (const computedVal in computedWatchInfo._triggerFromComputedAttached) {
                if (
                  computedWatchInfo._triggerFromComputedAttached.hasOwnProperty(
                    computedVal
                  )
                ) {
                  if (
                    pathsMap[computedVal] &&
                    computedWatchInfo._triggerFromComputedAttached[computedVal]
                  ) {
                    computedWatchInfo._triggerFromComputedAttached[
                      computedVal
                    ] = false;
                    return;
                  }
                }
              }
            }
            const oldVal = computedWatchInfo.watchCurVal[watchPath];

            // get new watching field value
            const originalCurValWithOptions = paths.map(({ path, options }) => {
              const val = dataPath.getDataOnPath(this.data, path);
              return { val, options };
            });
            const curVal = originalCurValWithOptions.map(({ val, options }) =>
              options.deepCmp ? deepClone(val) : val
            );
            computedWatchInfo.watchCurVal[watchPath] = curVal;

            // compare
            let changed = false;
            for (let i = 0; i < curVal.length; i++) {
              const options = paths[i].options;
              const deepCmp = options.deepCmp;
              if (
                deepCmp
                  ? !deepEqual(oldVal[i], curVal[i])
                  : oldVal[i] !== curVal[i]
              ) {
                changed = true;
                break;
              }
            }

            // if changed, update
            if (changed) {
              watchDef[watchPath].apply(
                this,
                originalCurValWithOptions.map(({ val }) => val)
              );
            }
          },
        });
      });
    }

    if (typeof defFields.observers !== "object") {
      defFields.observers = {};
    }

    if (Array.isArray(defFields.observers)) {
      defFields.observers.push(...observersItems);
    } else {
      observersItems.forEach((item) => {
        // defFields.observers[item.fields] = item.observer
        // observers:数据监听器可以用于监听和响应任何属性和数据字段的变化
        const f = defFields.observers[item.fields];
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
  },
});
