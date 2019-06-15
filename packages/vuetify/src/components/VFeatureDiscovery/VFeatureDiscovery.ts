// Styles
import './VFeatureDiscovery.sass'

// Mixins
import Activatable from '../../mixins/activatable'
import Colorable from '../../mixins/colorable'
import Elevatable from '../../mixins/elevatable'
import Positionable from '../../mixins/positionable'
import Stackable from '../../mixins/stackable'
import Themeable from '../../mixins/themeable'

// Directives
import ClickOutside from '../../directives/click-outside'
import Resize from '../../directives/resize'

// Helpers
import { convertToUnit, keyCodes } from '../../util/helpers'
import ThemeProvider from '../../util/ThemeProvider'

// Types
import { VNode, VNodeDirective, VNodeData } from 'vue'
import mixins from '../../util/mixins'
import { PropValidator } from 'vue/types/options'

const baseMixins = mixins(
  Activatable,
  Colorable,
  Elevatable,
  Positionable,
  Stackable,
  Themeable
)

interface options extends InstanceType<typeof baseMixins> {
  attach: boolean | string | Element
  $refs: {
    content: HTMLElement
    activator: HTMLElement
  }
}

interface CircleObject {
  x: number
  y: number
  r: number
  size: number
}

interface Dimensions {
  top: number
  left: number
  bottom: number
  right: number
  width: number
  height: number
  x: number
  y: number
}

function initDimensions (): Dimensions {
  return {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0
  }
}

/* @vue/component */
export default baseMixins.extend<options>().extend({
  name: 'v-feature-discovery',

  directives: {
    ClickOutside,
    Resize
  },

  props: {
    persistent: Boolean,
    flat: Boolean,
    closeOnClick: {
      type: Boolean,
      default: true
    },
    closeOnContentClick: {
      type: Boolean,
      default: true
    },
    color: {
      type: String,
      default: 'primary'
    },
    disableKeys: Boolean,
    highlightColor: {
      type: String,
      default: 'white'
    },
    size: {
      default: 700,
      type: [Number, String],
      validator: (v: string | number) => !isNaN(parseInt(v))
    },
    contentWidth: {
      type: [Number, String],
      default: 280,
      validator: (v: string | number) => !isNaN(parseInt(v))
    },
    positionX: {
      type: Number,
      default: null
    } as PropValidator<null | number>,
    positionY: {
      type: Number,
      default: null
    } as PropValidator<null | number>,
    value: {
      type: Boolean,
      default: true
    },
    noRipple: {
      type: Boolean
    },
    textColor: {
      type: String,
      default: 'white'
    },
    edgeX: {
      type: [Number, String],
      default: 200,
      validator: (v: string | number) => !isNaN(parseInt(v))
    },
    edgeY: {
      type: [Number, String],
      default: 144,
      validator: (v: string | number) => !isNaN(parseInt(v))
    },
    zIndex: {
      type: [Number, String],
      default: null,
      validator: (v: string | number) => !isNaN(parseInt(v))
    } as PropValidator<null | string | number>
  },

  data: () => ({
    absoluteX: 0,
    absoluteY: 0,
    activatorFixed: false,
    activatorNode: null as null | VNode | VNode[],
    dimensions: {
      activator: initDimensions(),
      content: initDimensions()
    },
    hasJustFocused: false,
    hasWindow: false,
    isContentActive: false,
    pageWidth: 0,
    pageHeight: 0,
    pageYOffset: 0,
    resizeTimeout: 0,
    activatorZIndexTimeout: 0,
    minHighlightPadding: 20,
    stackClass: 'v-feature-discovery__content--active',
    stackMinZIndex: 6
  }),

  computed: {
    classes (): object {
      return {
        'v-feature-discovery--flat': this.flat,
        'v-feature-discovery--active': this.isActive,
        'v-feature-discovery--no-ripple': this.noRipple,
        ...this.themeClasses
      }
    },
    hasActivator (): boolean {
      return !!this.$slots.activator ||
             !!this.$scopedSlots.activator ||
             !!this.activator
    },
    isOnEdgeLeft (): boolean {
      return this.dimensions.activator.left <= parseFloat(this.edgeX)
    },
    isOnEdgeRight (): boolean {
      return this.dimensions.activator.left >= this.pageWidth - parseFloat(this.edgeX)
    },
    isOnEdgeX (): boolean {
      return this.isOnEdgeLeft || this.isOnEdgeRight
    },
    isOnEdgeTop (): boolean {
      return this.dimensions.activator.top <= parseFloat(this.edgeY)
    },
    isOnEdgeBottom (): boolean {
      return this.dimensions.activator.top >= this.pageHeight - parseFloat(this.edgeY)
    },
    isOnEdgeY (): boolean {
      return this.isOnEdgeTop || this.isOnEdgeBottom
    },
    isOnEdge (): boolean {
      return this.isOnEdgeX || this.isOnEdgeY
    },
    computedWrapPadding (): number {
      return 40
    },
    computedWrapWidth (): number {
      return parseFloat(this.contentWidth) + 2 * this.defaultPadding
    },
    computedWrapOffsetLeft (): number {
      const halfWidth = this.computedWrapWidth / 2 - this.defaultPadding
      if (this.isOnEdgeLeft) return halfWidth
      if (this.isOnEdgeRight) return -halfWidth
      const isLeft = this.dimensions.activator.x < this.pageWidth / 2
      return isLeft ? this.highlightPadding : -this.highlightPadding
    },
    styles (): object {
      return {
        zIndex: this.zIndex || this.activeZIndex
      }
    },
    backdropSize (): number {
      if (!this.isOnEdge) return this.measureDesktopBackdrop().size
      const { width: w, height: h } = this.dimensions.content
      let width = w - 2 * this.defaultPadding
      if (!this.isOnEdgeX) {
        width = width / 2
      }
      const height = this.highlightOuterSize / 2 + h
      return 2 * (Math.hypot(width, height) + this.defaultPadding)
    },
    highlightInnerSize (): number {
      // Allow non fabs elements while keeping the size ratio 88:56
      const ratio = 11 / 7
      const minSize = 56 * ratio
      const { width, height } = this.dimensions.activator
      const size = Math.max(height, width) * ratio
      return Math.max(size, minSize)
    },
    highlightOuterSize (): number {
      return this.highlightInnerSize + this.defaultPadding
    },
    highlightPadding (): number {
      // Allow non fabs elements while keeping the padding ratio 88:20
      return Math.max(this.highlightInnerSize / 4.4, this.minHighlightPadding)
    },
    defaultPadding (): number {
      return this.highlightPadding * 2
    },
    computedBackdropOffsetLeft (): number {
      if (this.isOnEdge) return 0
      return this.computedWrapOffsetLeft
    },
    computedBackdropOffsetTop (): number {
      if (this.isOnEdge) return 0
      const { y } = this.measureDesktopBackdrop()
      return -y + this.highlightInnerSize - this.highlightPadding
    },
    backdropStyle (): object {
      const size = this.backdropSize
      const top = -this.backdropSize / 2 + this.computedBackdropOffsetTop
      const left = -this.backdropSize / 2 + this.computedBackdropOffsetLeft
      const originLeft = this.computedBackdropOffsetLeft < 0
        ? `calc(50% + ${convertToUnit(-this.computedBackdropOffsetLeft)})`
        : `calc(50% - ${convertToUnit(this.computedBackdropOffsetLeft)})`
      const originTop = this.computedBackdropOffsetTop < 0
        ? `calc(50% + ${convertToUnit(-this.computedBackdropOffsetTop)})`
        : `calc(50% - ${convertToUnit(this.computedBackdropOffsetTop)})`

      return {
        top: convertToUnit(top),
        left: convertToUnit(left),
        height: convertToUnit(size),
        width: convertToUnit(size),
        transformOrigin: `${originLeft} ${originTop}`
      }
    },
    highlightStyle (): object {
      const size = convertToUnit(this.highlightInnerSize)
      const halfSize = convertToUnit(-this.highlightInnerSize / 2)

      return {
        top: halfSize,
        left: halfSize,
        height: size,
        width: size
      }
    },
    wrapStyle (): object {
      let top = this.highlightOuterSize / 2
      if (this.isOnEdgeBottom) {
        top = -top - this.dimensions.content.height
      }
      let left = -this.computedWrapWidth / 2
      if (this.isOnEdgeX || !this.isOnEdgeY) {
        left += this.computedWrapOffsetLeft
      }

      return {
        top: convertToUnit(top),
        left: convertToUnit(left),
        height: 'auto',
        width: convertToUnit(this.computedWrapWidth),
        padding: `0 ${convertToUnit(this.defaultPadding)}`
      }
    },
    attrs (): object {
      return {
        'aria-hidden': !this.isActive
      }
    }
  },

  watch: {
    isActive (val: boolean) {
      val ? this.callActivate() : this.callDeactivate()
    },
    positionX: 'updateDimensions',
    positionY: 'updateDimensions'
  },

  beforeMount () {
    this.hasWindow = typeof window !== 'undefined'
  },

  mounted () {
    this.updateDimensions()
    this.isActive && this.activate()
  },

  methods: {
    absolutePosition (): Dimensions {
      return {
        ...initDimensions(),
        top: this.positionY || this.absoluteY,
        bottom: this.positionY || this.absoluteY,
        left: this.positionX || this.absoluteX,
        right: this.positionX || this.absoluteX
      }
    },
    callActivate () {
      this.hasWindow && this.activate()
    },
    callDeactivate () {
      this.isContentActive = false

      this.deactivate()
    },
    activate () {
      // Update coordinates and dimensions of content
      // and its activator
      this.updateDimensions()
      this.updateActivatorZIndex()
      // Start the transition
      requestAnimationFrame(() => {
        this.startTransition()
      })
    },
    deactivate () {
      this.updateActivatorZIndex()
    },
    updateActivatorZIndex () {
      const activator = this.getActivator()
      if (activator) {
        const zIndex = String(parseInt(this.zIndex || this.activeZIndex) + 1)
        if (this.isActive) {
          activator.style.zIndex = zIndex
        } else {
          // When deactivating feature discovery
          // the activator should be visible
          // until the end of the opacity transition
          // hacky but will revisit in the future
          clearTimeout(this.activatorZIndexTimeout)
          this.activatorZIndexTimeout = window.setTimeout(() => { activator.style.zIndex = '' }, 400)
        }
      }
    },
    checkActivatorFixed () {
      let el = this.getActivator()
      while (el) {
        if (window.getComputedStyle(el).position === 'fixed') {
          this.activatorFixed = true
          return
        }
        el = el.offsetParent as HTMLElement
      }
      this.activatorFixed = false
    },
    checkForPageYOffset () {
      if (this.hasWindow) {
        this.pageYOffset = this.activatorFixed ? 0 : this.getOffsetTop()
      }
    },
    getRoundedBoundedClientRect (el: Element): Dimensions {
      const rect = el.getBoundingClientRect()
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(Math.round(rect.left) + Math.round(rect.width) / 2),
        y: Math.round(Math.round(rect.top) + Math.round(rect.height) / 2)
      }
    },
    measure (el: HTMLElement): Dimensions {
      return (!el || !this.hasWindow) ? initDimensions() : this.getRoundedBoundedClientRect(el)
    },
    measureDesktopBackdrop (): CircleObject {
      const content = this.dimensions.content
      const x = content.width / 2 - this.defaultPadding
      // Calculate the circles tangent point A(ax, ay) using cycloid curve
      // Get hightlight radius with padding
      const radius = this.highlightOuterSize / 2
      // Get rolled distance/perimeter
      const diameter = -this.computedWrapOffsetLeft
      // Calculate rolled angle
      const t = diameter / (2 * radius)
      // Calculate the tangent point
      // using the circle bottom center point as origin
      let ax = radius * Math.sin(t)
      let ay = radius * (1 + Math.cos(t))

      // Move the origin to the rectangle top left absolute position
      ax += x + diameter

      // Calculate backdrop central point B(x, by) and radius (br)
      const by = (Math.pow(ax, 2) - (2 * ax * x) + Math.pow(ay, 2)) / (2 * ay)
      const br = Math.hypot(x, by)

      // Move origin to the rectangle bottom left absolute position
      ay += content.height
      // Calculate backdrop central point C(x, cy) and radius (cr)
      const cy = (Math.pow(ax, 2) - (2 * ax * x) + Math.pow(ay, 2)) / (2 * ay)
      const cr = Math.hypot(x, cy)

      if (br > cr) {
        return {
          x,
          y: by,
          r: br,
          size: 2 * (br + this.defaultPadding)
        }
      }

      return {
        x,
        y: cy - content.height,
        r: cr,
        size: 2 * (cr + this.defaultPadding)
      }
    },
    sneakPeek (cb: () => void) {
      requestAnimationFrame(() => {
        const el = this.$refs.content

        if (!el || el.style.display !== 'none') {
          cb()
          return
        }

        el.style.display = 'inline-block'
        cb()
        el.style.display = 'none'
      })
    },
    startTransition () {
      return new Promise<void>(resolve => requestAnimationFrame(() => {
        this.isContentActive = this.hasJustFocused = this.isActive
        resolve()
      }))
    },
    updateDimensions () {
      this.checkActivatorFixed()
      this.checkForPageYOffset()
      this.pageWidth = document.documentElement.clientWidth
      this.pageHeight = document.documentElement.clientHeight

      // Activator should already be shown
      if (!this.hasActivator || this.absolute) {
        this.dimensions.activator = this.absolutePosition()
      } else {
        const activator = this.getActivator()
        if (activator) this.dimensions.activator = this.measure(activator)
      }

      // Display and hide to get dimensions
      this.sneakPeek(() => {
        this.dimensions.content = this.measure(this.$refs.content)
      })
    },
    getOffsetLeft () {
      if (!this.hasWindow) return 0

      return window.pageXOffset ||
        document.documentElement.scrollLeft
    },
    getOffsetTop () {
      if (!this.hasWindow) return 0

      return window.pageYOffset ||
        document.documentElement.scrollTop
    },
    onKeyDown (e: KeyboardEvent) {
      if (this.closeConditional() && e.keyCode === keyCodes.esc) {
        this.isActive = false
        const activator = this.getActivator()
        this.$nextTick(() => activator && (activator as HTMLElement).focus())
      }
    },
    closeConditional (): boolean {
      return !this.persistent && this.isActive
    },
    genDirectives (): VNodeDirective[] {
      const directives: VNodeDirective[] = [{
        name: 'show',
        value: this.isContentActive
      }]

      if (this.closeOnClick) {
        directives.push({
          name: 'click-outside',
          value: () => { this.isActive = false },
          args: {
            closeConditional: this.closeConditional,
            include: () => [this.$el]
          }
        } as any)
      }

      return directives
    },
    genBackdrop (): VNode {
      return this.$createElement('div', this.setBackgroundColor(this.color, {
        staticClass: 'v-feature-discovery__backdrop',
        class: this.elevationClasses,
        style: this.backdropStyle
      }), [])
    },
    genHighlight (): VNode {
      return this.$createElement('div', this.setTextColor(this.color, this.setBackgroundColor(this.highlightColor, {
        staticClass: 'v-feature-discovery__highlight',
        style: this.highlightStyle,
        attrs: {
          'aria-hidden': true
        }
      })))
    },
    genWrap (): VNode {
      return this.$createElement('div',
        {
          staticClass: 'v-feature-discovery__wrap',
          style: this.wrapStyle,
          ref: 'content'
        },
        this.$slots.default
      )
    },
    genContent (): VNode {
      const options = {
        staticClass: 'v-feature-discovery__content',
        class: {
          ...this.rootThemeClasses,
          ...this.themeClasses,
          'v-feature-discovery__content--fixed': this.activatorFixed,
          'v-feature-discovery__content--flat': this.flat,
          'v-feature-discovery__content--active': this.isActive,
          'v-feature-discovery__content--no-ripple': this.noRipple
        },
        style: this.styles,
        directives: this.genDirectives(),
        on: {
          click: (event: Event) => {
            event.stopPropagation()

            const target = event.target as HTMLElement

            if (target.getAttribute('disabled')) return
            if (this.closeOnContentClick) this.isActive = false
          },
          keydown: this.onKeyDown
        }
      } as VNodeData

      return this.$createElement(
        'div',
        this.setTextColor(this.textColor, options),
        [
          this.genBackdrop(),
          this.genHighlight(),
          this.genWrap()
        ]
      )
    },
    onResize () {
      if (!this.isActive) return

      // Account for screen resize
      // and orientation change
      // eslint-disable-next-line no-unused-expressions
      this.$refs.content.offsetWidth
      this.updateDimensions()

      // When resizing to a smaller width
      // content width is evaluated before
      // the new activator width has been
      // set, causing it to not size properly
      // hacky but will revisit in the future
      clearTimeout(this.resizeTimeout)
      this.resizeTimeout = window.setTimeout(this.updateDimensions, 100)
    }
  },

  render (h): VNode {
    const data = {
      staticClass: 'v-feature-discovery',
      class: {
        'v-feature-discovery--inline': this.hasActivator
      },
      directives: [{
        arg: '500',
        name: 'resize',
        value: this.onResize
      }],
      on: this.disableKeys ? undefined : {
        keydown: this.onKeyDown
      }
    }

    return h('div', data, [
      this.genActivator(),
      this.$createElement(ThemeProvider, {
        props: {
          root: true,
          light: this.light,
          dark: this.dark
        }
      }, [this.genContent()])
    ])
  }
})
