/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import type { FragmentDefinition } from '../../language/ast';


export function cycleErrorMessage(
  fragName: any,
  spreadNames: Array<any>
): string {
  var via = spreadNames.length ? ' via ' + spreadNames.join(', ') : '';
  return `Cannot spread fragment "${fragName}" within itself${via}.`;
}

export function NoFragmentCycles(context: ValidationContext): any {
  var errors = [];

  // Tracks already visited fragments to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  var visitedFrags = Object.create(null);

  // Array of AST nodes used to produce meaningful errors
  var spreadPath = [];

  // Position in the spread path
  var spreadPathIndexByName = Object.create(null);

  return {
    Document: {
      leave() {
        if (errors.length) {
          return errors;
        }
      }
    },
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      if (!visitedFrags[node.name.value]) {
        detectCycleRecursive(node);
      }
      return false;
    },
  };

  // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.
  function detectCycleRecursive(fragment: FragmentDefinition) {
    const fragmentName = fragment.name.value;
    visitedFrags[fragmentName] = true;

    const spreadNodes = context.getFragmentSpreads(fragment);
    if (spreadNodes.length === 0) {
      return;
    }

    spreadPathIndexByName[fragmentName] = spreadPath.length;

    for (let i = 0; i < spreadNodes.length; i++) {
      const spreadNode = spreadNodes[i];
      const spreadName = spreadNode.name.value;
      const cycleIndex = spreadPathIndexByName[spreadName];

      if (cycleIndex === undefined) {
        spreadPath.push(spreadNode);
        if (!visitedFrags[spreadName]) {
          const spreadFragment = context.getFragment(spreadName);
          if (spreadFragment) {
            detectCycleRecursive(spreadFragment);
          }
        }
        spreadPath.pop();
      } else {
        const cyclePath = spreadPath.slice(cycleIndex);
        errors.push(new GraphQLError(
          cycleErrorMessage(
            spreadName,
            cyclePath.map(s => s.name.value)
          ),
          cyclePath.concat(spreadNode)
        ));
      }
    }

    spreadPathIndexByName[fragmentName] = undefined;
  }
}
