/**
 * Creates the real Strategus PLP modelSettings shape for each supported model type.
 * Shape: { fitFunction, param: { ..., attr_settings: { name, modelType } }, attr_class: 'modelSettings' }
 */
export function createPlpModelSettings(modelType: string): Record<string, unknown> {
  switch (modelType) {
    case 'gradientBoosting':
      return {
        fitFunction: 'fitGradientBoostingMachine',
        param: {
          ntrees: [100, 300],
          minRows: [20],
          maxDepth: [4, 6, 8],
          varSampRate: [0.6, 0.8],
          learnRate: [0.01, 0.1, 0.3],
          seed: 1234,
          attr_settings: {
            name: 'Gradient Boosting Machine',
            modelType: 'BRT',
          },
        },
        attr_class: 'modelSettings',
      };

    case 'randomForest':
      return {
        fitFunction: 'fitRandomForest',
        param: {
          ntrees: [500],
          maxDepth: [4, 17],
          minRows: [1],
          mtries: [-1],
          varImp: [true],
          seed: 1234,
          attr_settings: {
            name: 'Random Forest',
            modelType: 'RandomForest',
          },
        },
        attr_class: 'modelSettings',
      };

    case 'adaBoost':
      return {
        fitFunction: 'fitAdaBoost',
        param: {
          nEstimators: [50, 200],
          learningRate: [1],
          seed: 1234,
          attr_settings: {
            name: 'AdaBoost',
            modelType: 'adaBoost',
          },
        },
        attr_class: 'modelSettings',
      };

    case 'decisionTree':
      return {
        fitFunction: 'fitDecisionTree',
        param: {
          maxDepth: [4, 10, 17],
          minSamplesSplit: [2],
          minSamplesLeaf: [1],
          minImpurityDecrease: [10e-7],
          seed: 1234,
          attr_settings: {
            name: 'Decision Tree',
            modelType: 'decisionTree',
          },
        },
        attr_class: 'modelSettings',
      };

    case 'mlp':
      return {
        fitFunction: 'fitMLP',
        param: {
          size: [4],
          alpha: [0.00001],
          seed: 1234,
          attr_settings: {
            name: 'Multilayer Perceptron',
            modelType: 'MLP',
          },
        },
        attr_class: 'modelSettings',
      };

    case 'lassoLogisticRegression':
    default:
      return {
        fitFunction: 'fitCyclopsModel',
        param: {
          priorParams: {
            priorType: 'laplace',
            forceIntercept: false,
            variance: 0.01,
            exclude: 0,
          },
          includeCovariateIds: null,
          upperLimit: 20,
          lowerLimit: 0.01,
          priorCoefs: null,
          attr_settings: {
            priorfunction: 'Cyclops::createPrior',
            selectorType: 'byPid',
            crossValidationInPrior: true,
            modelType: 'logistic',
            addIntercept: true,
            useControl: true,
            seed: 1,
            name: 'Lasso Logistic Regression',
            threads: -1,
            tolerance: 2e-6,
            cvRepetitions: 1,
            maxIterations: 3000,
          },
          attr_modelType: 'binary',
          attr_saveType: 'RtoJson',
        },
        attr_class: 'modelSettings',
      };
  }
}

/**
 * Reads back the modelType from a serialized modelSettings object.
 * Checks param.attr_settings.modelType, then fitFunction as fallback.
 */
export function readPlpModelType(modelSettings: Record<string, unknown>): string {
  const param = modelSettings['param'] as Record<string, unknown> | undefined;
  if (param) {
    const attrSettings = param['attr_settings'] as Record<string, unknown> | undefined;
    if (attrSettings && typeof attrSettings['modelType'] === 'string') {
      // Map internal modelType back to our store value
      const typeMap: Record<string, string> = {
        logistic: 'lassoLogisticRegression',
        BRT: 'gradientBoosting',
        RandomForest: 'randomForest',
        adaBoost: 'adaBoost',
        decisionTree: 'decisionTree',
        MLP: 'mlp',
      };
      return typeMap[attrSettings['modelType']] ?? 'lassoLogisticRegression';
    }
  }
  // Fallback: infer from fitFunction
  const fitFunction = modelSettings['fitFunction'] as string | undefined;
  if (fitFunction === 'fitGradientBoostingMachine') return 'gradientBoosting';
  if (fitFunction === 'fitRandomForest') return 'randomForest';
  if (fitFunction === 'fitAdaBoost') return 'adaBoost';
  if (fitFunction === 'fitDecisionTree') return 'decisionTree';
  if (fitFunction === 'fitMLP') return 'mlp';
  return 'lassoLogisticRegression';
}
