import Vue from 'vue'

import { between } from '../../utils/format.js'
import { setScrollPosition, setHorizontalScrollPosition } from '../../utils/scroll.js'
import { mergeSlot } from '../../utils/slot.js'
import { cache } from '../../utils/vm.js'

import QResizeObserver from '../resize-observer/QResizeObserver.js'
import QScrollObserver from '../scroll-observer/QScrollObserver.js'
import TouchPan from '../../directives/TouchPan.js'
import DarkMixin from '../../mixins/dark.js'

export default Vue.extend({
  name: 'QScrollArea',

  mixins: [ DarkMixin ],

  directives: {
    TouchPan
  },

  props: {
    barStyle: [ Array, String, Object ],
    thumbStyle: Object,
    contentStyle: [ Array, String, Object ],
    contentActiveStyle: [ Array, String, Object ],

    delay: {
      type: [String, Number],
      default: 1000
    },

    visible: {
      type: Boolean,
      default: null
    },

    horizontal: Boolean
  },

  data () {
    return {
      active: false,
      hover: this.visible === true,
      containerWidth: 0,
      containerHeight: 0,
      scrollPosition: 0,
      scrollSize: 0
    }
  },

  watch: {
    visible (val) {
      this.hover = val === true
    }
  },

  computed: {
    classes () {
      return 'q-scrollarea' +
        (this.isDark === true ? ' q-scrollarea--dark' : '')
    },

    thumbHidden () {
      return this.scrollSize <= this.containerSize ||
        (this.active === false && this.hover === false)
    },

    thumbSize () {
      return Math.round(
        between(
          this.containerSize * this.containerSize / this.scrollSize,
          50,
          this.containerSize
        )
      )
    },

    style () {
      const pos = this.scrollPercentage * (this.containerSize - this.thumbSize)
      return Object.assign(
        {},
        this.thumbStyle,
        this.horizontal === true
          ? {
            left: `${pos}px`,
            width: `${this.thumbSize}px`
          }
          : {
            top: `${pos}px`,
            height: `${this.thumbSize}px`
          }
      )
    },

    mainStyle () {
      return this.thumbHidden === true
        ? this.contentStyle
        : this.contentActiveStyle
    },

    scrollPercentage () {
      const p = between(this.scrollPosition / (this.scrollSize - this.containerSize), 0, 1)
      return Math.round(p * 10000) / 10000
    },

    direction () {
      return this.horizontal === true
        ? 'right'
        : 'down'
    },

    containerSize () {
      return this[`container${this.horizontal === true ? 'Width' : 'Height'}`]
    },

    dirProps () {
      return this.horizontal === true
        ? 'scrollLeft'
        : 'scrollTop'
    },

    thumbClass () {
      return `q-scrollarea__thumb--${this.horizontal === true ? 'h absolute-bottom' : 'v absolute-right'}` +
        (this.thumbHidden === true ? ' q-scrollarea__thumb--invisible' : '')
    },

    barClass () {
      return `q-scrollarea__bar--${this.horizontal === true ? 'h absolute-bottom' : 'v absolute-right'}` +
        (this.thumbHidden === true ? ' q-scrollarea__bar--invisible' : '')
    }
  },

  methods: {
    getScrollTarget () {
      return this.$refs.target
    },

    getScrollPosition () {
      return this.$q.platform.is.desktop === true
        ? this.scrollPosition
        : this.$refs.target[this.dirProps]
    },

    setScrollPosition (offset, duration) {
      const fn = this.horizontal === true
        ? setHorizontalScrollPosition
        : setScrollPosition

      fn(this.$refs.target, offset, duration)
    },

    __updateContainer ({ height, width }) {
      if (this.containerWidth !== width) {
        this.containerWidth = width
        this.__setActive(true, true)
      }

      if (this.containerHeight !== height) {
        this.containerHeight = height
        this.__setActive(true, true)
      }
    },

    __updateScroll ({ position }) {
      if (this.scrollPosition !== position) {
        this.scrollPosition = position
        this.__setActive(true, true)
      }
    },

    __updateScrollSize ({ height, width }) {
      if (this.horizontal) {
        if (this.scrollSize !== width) {
          this.scrollSize = width
          this.__setActive(true, true)
        }
      }
      else {
        if (this.scrollSize !== height) {
          this.scrollSize = height
          this.__setActive(true, true)
        }
      }
    },

    __panThumb (e) {
      if (this.thumbHidden === true) {
        return
      }

      if (e.isFirst === true) {
        this.refPos = this.scrollPosition
        this.__setActive(true, true)
      }

      if (e.isFinal === true) {
        this.__setActive(false)
      }

      const multiplier = (this.scrollSize - this.containerSize) / (this.containerSize - this.thumbSize)
      const distance = this.horizontal ? e.distance.x : e.distance.y
      const pos = this.refPos + (e.direction === this.direction ? 1 : -1) * distance * multiplier
      this.__setScroll(pos)
    },

    __mouseDown (evt) {
      if (this.thumbHidden !== true) {
        const pos = evt[`offset${this.horizontal === true ? 'X' : 'Y'}`] - this.thumbSize / 2
        this.__setScroll(pos / this.containerSize * this.scrollSize)

        // activate thumb pan
        if (this.$refs.thumb !== void 0) {
          this.$refs.thumb.dispatchEvent(new MouseEvent(evt.type, evt))
        }
      }
    },

    __setActive (active, timer) {
      clearTimeout(this.timer)

      if (active === this.active) {
        if (active && this.timer) {
          this.__startTimer()
        }
        return
      }

      if (active) {
        this.active = true
        if (timer) {
          this.__startTimer()
        }
      }
      else {
        this.active = false
      }
    },

    __startTimer () {
      this.timer = setTimeout(() => {
        this.active = false
        this.timer = null
      }, this.delay)
    },

    __setScroll (offset) {
      this.$refs.target[this.dirProps] = offset
    }
  },

  render (h) {
    return h('div', {
      class: this.classes,
      on: this.visible === null
        ? cache(this, 'desk', {
          mouseenter: () => { this.hover = true },
          mouseleave: () => { this.hover = false }
        })
        : null
    }, [
      h('div', {
        ref: 'target',
        staticClass: 'scroll relative-position fit hide-scrollbar'
      }, [
        h('div', {
          staticClass: 'absolute',
          style: this.mainStyle,
          class: `full-${this.horizontal === true ? 'height' : 'width'}`
        }, mergeSlot([
          h(QResizeObserver, {
            on: cache(this, 'resizeIn', { resize: this.__updateScrollSize })
          })
        ], this, 'default')),

        h(QScrollObserver, {
          props: { horizontal: this.horizontal },
          on: cache(this, 'scroll', { scroll: this.__updateScroll })
        })
      ]),

      h(QResizeObserver, {
        on: cache(this, 'resizeOut', { resize: this.__updateContainer })
      }),

      h('div', {
        staticClass: 'q-scrollarea__bar',
        style: this.barStyle,
        class: this.barClass,
        on: cache(this, 'bar', {
          mousedown: this.__mouseDown
        })
      }),

      h('div', {
        ref: 'thumb',
        staticClass: 'q-scrollarea__thumb',
        style: this.style,
        class: this.thumbClass,
        directives: cache(this, 'thumb#' + this.horizontal, [{
          name: 'touch-pan',
          modifiers: {
            vertical: !this.horizontal,
            horizontal: this.horizontal,
            prevent: true,
            mouse: true,
            mouseAllDir: true
          },
          value: this.__panThumb
        }])
      })
    ])
  }
})
