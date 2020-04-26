/**
 * @desc: todo - todoList
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import create from '../../../utils/create.js'
import { todoType } from '../../../constants/dictionary.js';

create.Component({
  use: ['todo'],
  // 计算属性
  computed: {
    visibleTodoList() {
      const { todoList, curFilterType } = this.todo
      const { nameToCode } = todoType
      if (curFilterType === nameToCode.Active) {
        return todoList.filter(item => !item.isDone)
      }
      if (curFilterType === nameToCode.Completed) {
        return todoList.filter(item => item.isDone)
      }
      return todoList
    }
  },
  // Component properties
  properties: {

  },

  data: {

  },

  // Component methods
  methods: {

  }
})
