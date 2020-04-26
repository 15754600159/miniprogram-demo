/**
 * @desc todo状态
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import { todoType } from '../constants/dictionary.js'

/**
 * todoList todo列表
 * curFilterType 当前选择的筛选类型
 */
export default {
  todoList: [
    { name: '18:00 吃晚饭', isDone: false },
  ],
  curFilterType: todoType.nameToCode.All,
}