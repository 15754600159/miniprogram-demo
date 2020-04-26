/**
 * @desc: 登录api
 * @author: shengshunyan
 * @date: 2020-4-18
 */


import {
  serverIp,
  createFetchApi
} from '../utils/ajax.js';

const loginUrlPrefix = `${serverIp}/api/user`

const loginAPI = createFetchApi({
  // 登录
  login: {
    url: `${loginUrlPrefix}/login`,
    method: 'POST'
  },
  // 个人信息获取
  getUserInfo: {
    url: `${loginUrlPrefix}/getUserInfo`,
    method: 'GET'
  },
  // 登出
  logout: {
    url: `${loginUrlPrefix}/logout`,
    method: 'GET'
  },
})

export default loginAPI;