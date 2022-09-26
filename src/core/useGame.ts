/*
 * @Description:
 * @Author: wangwei
 * @Date: 2022-09-26 17:19:24
 * @LastEditors: wangwei
 * @LastEditTime: 2022-09-26 17:56:39
 * @FilePath: /xlegex/src/core/useGame.ts
 */
import { onMounted, ref } from 'vue'
import { ceil, floor, random, shuffle } from 'lodash-es'
const defaultGameConfig: GameConfig = {
  cardNum: 4,
  layerNum: 2,
  trap: true,
  delNode: false,
}

export function useGame(config: GameConfig) {
  const {
    container,
    cardNum,
    layerNum,
    trap,
    delNode,
    events = {},
  } = { ...defaultGameConfig, ...config }
  const histroyList = ref<CardNode[]>([])
  const backFlag = ref(false)
  const removeFlag = ref(false)
  const removeList = ref<CardNode[]>([])
  const preNode = ref<CardNode | null>(null)
  const size = 40
  const isTrap = trap && floor(random(0, 100)) !== 50
  const nodes = ref<CardNode[]>([])
  const indexSet = new Set()
  let perFloorNodes: CardNode[] = []

  // 生成节点池
  const itemTypes = new Array(cardNum).fill(0).map((_, index) => index + 1)
  let itemList: number[] = []
  const selectedNodes = ref<CardNode[]>([])
  for (let i = 0; i < 3 * layerNum; i++) itemList = [...itemList, ...itemTypes]

  if (isTrap) {
    const len = itemList.length
    itemList.splice(len - cardNum, len)
  }
  // 打乱节点
  itemList = shuffle(shuffle(itemList))

  // 初始化各个层级节点
  let len = 0
  let floorIndex = 1
  const floorList: number[][] = []
  const itemLength = itemList.length
  while (len <= itemLength) {
    const maxFloorNum = floorIndex * floorIndex
    const floorNum = ceil(random(maxFloorNum / 2, maxFloorNum))
    floorList.push(itemList.splice(0, floorNum))
    len += floorNum
    floorIndex++
  }

  function updateState() {
    nodes.value.forEach((o) => {
      o.state = o.parents.every(p => p.state > 0) ? 1 : 0
    })
  }

  function handleSelect(node: CardNode) {
    if (selectedNodes.value.length === 7)
      return
    node.state = 2
    histroyList.value.push(node)
    preNode.value = node
    const index = nodes.value.findIndex(o => o.id === node.id)
    if (index > -1) {
      delNode && nodes.value.splice(index, 1)
      // 判断是否已经清空卡牌，即是否胜利
      if (
        delNode
          ? nodes.value.length === 0
          : nodes.value.every(o => o.state > 0)
      ) {
        removeFlag.value = true
        backFlag.value = true
        events.winCallback && events.winCallback()
      }
    }
    // 判断是否有可以消除的节点
    if (selectedNodes.value.filter(s => s.type === node.type).length === 2) {
      selectedNodes.value.push(node)
      // 为了动画效果添加延迟
      setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          const index = selectedNodes.value.findIndex(
            o => o.type === node.type,
          )
          selectedNodes.value.splice(index, 1)
        }
        preNode.value = null
        events.dropCallback && events.dropCallback()
      }, 100)
    }
    else {
      const index = selectedNodes.value.findIndex(o => o.type === node.type)
      if (index > -1)
        selectedNodes.value.splice(index, 0, node)
      else selectedNodes.value.push(node)
      events.clickCallback && events.clickCallback()
      // 判断卡槽是否已满，即失败
      if (selectedNodes.value.length === 7) {
        removeFlag.value = true
        backFlag.value = true
        events.loseCallback && events.loseCallback()
      }
    }
  }

  function handleSelectRemove(node: CardNode) {
    const index = removeList.value.findIndex(o => o.id === node.id)
    if (index > -1)
      removeList.value.splice(index, 1)
    handleSelect(node)
  }

  function handleBack() {
    const node = preNode.value
    if (!node)
      return
    preNode.value = null
    backFlag.value = true
    node.state = 0
    delNode && nodes.value.push(node)
    const index = selectedNodes.value.findIndex(o => o.id === node.id)
    selectedNodes.value.splice(index, 1)
  }

  function handleRemove() {
    // 从selectedNodes.value中取出3个 到 removeList.value中

    if (selectedNodes.value.length < 3)
      return
    removeFlag.value = true
    preNode.value = null
    for (let i = 0; i < 3; i++) {
      const node = selectedNodes.value.shift()
      if (!node)
        return
      removeList.value.push(node)
    }
  }

  onMounted(() => {
    const containerWidth = container.value!.clientWidth
    const containerHeight = container.value!.clientHeight
    const width = containerWidth / 2
    const height = containerHeight / 2 - 60

    floorList.forEach((o, index) => {
      indexSet.clear()
      let i = 0
      const floorNodes: CardNode[] = []
      o.forEach((k) => {
        i = floor(random(0, (index + 1) ** 2))
        while (indexSet.has(i)) i = floor(random(0, (index + 1) ** 2))
        const row = floor(i / (index + 1))
        const column = index ? i % index : 0
        const node: CardNode = {
          id: `${index}-${i}`,
          type: k,
          zIndex: index,
          index: i,
          row,
          column,
          top: height + (size * row - (size / 2) * index),
          left: width + (size * column - (size / 2) * index),
          parents: [],
          state: 0,
        }
        const xy = [node.top, node.left]
        perFloorNodes.forEach((e) => {
          if (
            Math.abs(e.top - xy[0]) <= size
            && Math.abs(e.left - xy[1]) <= size
          )
            e.parents.push(node)
        })
        floorNodes.push(node)
        indexSet.add(i)
      })
      nodes.value = nodes.value.concat(floorNodes)
      perFloorNodes = floorNodes
    })

    updateState()
  })

  return {
    nodes,
    selectedNodes,
    handleSelect,
    handleBack,
    backFlag,
    handleRemove,
    removeFlag,
    removeList,
    handleSelectRemove,
  }
}
