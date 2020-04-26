/**
 * @desc 登录
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import loginAPI from '../../api/login-api.js';
import {
  watch,
  computed
} from '../../utils/vuefy.js';

const app = getApp();

Page({
  /**
   * phoneNumber 手机号码
   * password 密码
   * isSubmitBtnDisabled 提交按钮是否不可点击
   * isSubmitBtnLoading 提交按钮是否loading
   */
  data: {
    phoneNumber: '',
    password: '',
    isSubmitBtnDisabled: true,
    isSubmitBtnLoading: false,
  },

  // Lifecycle function--Called when page load
  onLoad: function (options) {
    /**
     * 计算属性
     * isPhoneNumberClearShow 手机号输入框的清除按钮是否显示
     * isPasswordClearShow 密码输入框的清除按钮是否显示
     */
    computed(this, {
      isPhoneNumberClearShow() {
        return this.data.phoneNumber.length > 0;
      },
      isPasswordClearShow() {
        return this.data.password.length > 0;
      },
    })
    /**
     * 观察属性变化
     */
    watch(this, {
      phoneNumber(newVal) {
        this.setData({
          isSubmitBtnDisabled: !(newVal.length > 0 && this.data.password.length > 0)
        });
      },
      password(newVal) {
        this.setData({
          isSubmitBtnDisabled: !(this.data.phoneNumber.length > 0 && newVal.length > 0)
        });
      },
    })
  },

  // 号码输入框输入
  phoneInputChange(event) {
    this.setData({
      phoneNumber: event.detail.value
    });
  },

  // 清除号码输入框的值
  clearPhoneNumber() {
    this.setData({
      phoneNumber: ''
    });
  },

  // 密码输入框输入
  passwordInputChange(event) {
    this.setData({
      password: event.detail.value
    });
  },

  // 清除密码输入框的值
  clearPassword() {
    this.setData({
      password: ''
    });
  },

  // 发起登录请求
  async submit(event) {
    const {
      phoneNumber,
      password
    } = this.data;

    // 先判断号码是否合规
    if (!/^1[3456789]\d{9}$/.test(phoneNumber)) {
      wx.showToast({
        title: '请输入正确的11位手机号码',
        icon: 'none',
      })
      return;
    }

    // 按钮loading true
    this.setData({
      isSubmitBtnLoading: true,
    })

    const data = {
      phoneNumber,
      password,
    }
    try {
      const res = await loginAPI.login({ data })
      // 存储用户信息
      Object.assign(app.globalData.userInfo, res.data)
      // 页面跳转
      wx.reLaunch({
        url: '/pages/user/user',
      });
    } catch (e) {
      wx.showToast({
        title: '登录出错',
        icon: 'none',
      })
    }
  },
})