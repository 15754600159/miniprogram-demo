/**
 * @desc: todo - todoInput
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import create from '../../../utils/create.js'

create.Component({
  // Component properties
  properties: {

  },

  /**
   * inputValue todo输入框的值
   */
  data: {
    inputValue: ''
  },

  // Component methods
  methods: {
    // 输入框输入
    inputChange(event) {
      this.setData({
        inputValue: event.detail.value
      });
    },

    // 添加todo选项
    addTodo() {
      const { inputValue } = this.data
      const { todo } = this.store.data;

      if (inputValue.trim().length < 0) {
        return
      }
      todo.todoList.push({
        name: inputValue,
        isDone: false,
      });
      this.setData({ inputValue: '' })
    }
  }
})
