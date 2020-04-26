/**
 * @desc: todo - todoFooter
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import create from '../../../utils/create.js'
import { todoType } from '../../../constants/dictionary.js';

const todoTypeList = Object.keys(todoType.codeToName).map(item => ({
  key: item,
  title: todoType.codeToName[item]
}))

create.Component({
  use: ['todo'],
  /**
   * @desc 计算属性
   * todoLength todo列表的长度
   */
  computed: {
    todoLength() {
      return this.todo.todoList.length
    }
  },
  // Component properties
  properties: {

  },

  /**
   * todoType todo类型
   */
  data: {
    todoType: todoTypeList
  },

  // Component methods
  methods: {
    // 点击类型筛选
    handleClickType(event) {
      const { typeCode } = event.currentTarget.dataset
      const { todo } = this.store.data;
      todo.curFilterType = typeCode
    },
    // 清除已完成
    handleClearCompleted() {
      const { todo } = this.store.data;
      todo.todoList = todo.todoList.filter(item => !item.isDone)
    }
  }
})
