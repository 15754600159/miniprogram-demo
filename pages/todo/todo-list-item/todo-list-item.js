/**
 * @desc: todo - todoList - todoListItem
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import create from '../../../utils/create.js'

create.Component({
  // Component properties
  properties: {
    data: Object,
    index: Number,
  },

  /**
   * isDone 是否已完成
   */
  data: {
    
  },

  // Component methods
  methods: {
    // 完成/未完成 切换
    checkboxChange(event) {
      const { todo } = this.store.data;
      if (event.detail.value.length > 0) {
        todo.todoList[this.data.index] = { 
          ...todo.todoList[this.data.index], 
          isDone: true 
        }
        return
      } 
      todo.todoList[this.data.index] = { 
        ...todo.todoList[this.data.index], 
        isDone: false 
      }
    },

    // 删除
    deleteItem() {
      const { todo } = this.store.data;
      todo.todoList.splice(this.data.index, 1)
    }
  }
})
