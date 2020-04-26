/**
 * @desc 请求封装
 * @author: shengshunyan
 * @date: 2020-4-18
 */

// 后台服务地址
export const serverIp = 'http://localhost:8000';

// 请求对象构造器
export function createFetchApi(requestMap) {
  const newRequestMap = {}

  Object.keys(requestMap).forEach(key => {
    const options = requestMap[key]

    newRequestMap[key] = ({ data } = {}) => new Promise(function(resolve, reject) {
      // 获取存储在storage中的登录标识，并放到请求头中
      try {
        // 可以添加用户权限校验头字段
        const authorization = wx.getStorageSync('Authorization');
        const header = {};
        if (authorization) {
          header.Authorization = authorization;
        }

        wx.request({
          ...options,
          data,
          header,
          success(res) {
            // 请求出错
            if (res.statusCode !== 200) {
              wx.showToast({
                title: `请求返回出错，${res.statusCode}`,
                icon: 'none',
              })
              return reject(`请求返回出错，${res.statusCode}`);
            }

            // 未登录
            if (res.data.statusCode === 401) {
              wx.showToast({
                title: '请重新登录',
                icon: 'none',
              })
              wx.redirectTo({
                url: '/pages/login-index/login-index'
              });
              wx.removeStorageSync('Authorization');
              return reject(res.data.message);
            }

            // 请求正常返回
            if (res.data.statusCode === 200) {
              return resolve(res.data)
            }

            // 其他情况都视为出错
            wx.showToast({
              title: res.data.message,
              icon: 'none',
            })
            reject(res.data.message);
          },
          // 发送请求失败
          fail(res) {
            wx.showToast({
              title: '发送请求失败',
              icon: 'none',
            })
            reject('发送请求失败');
          }
        })
      } catch (e) {
        // Do something when catch error
      }
    });
  })

  return newRequestMap
}