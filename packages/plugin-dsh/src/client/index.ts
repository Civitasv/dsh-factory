import { createElement, type ReactNode } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  PropsRuntime,
  SlotComponent,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import {
  ORVEN_PANEL_ID,
  OrvenGraphController,
  type OrvenClientContext,
} from './controller.js'
import {
  ORVEN_PANEL_CSS,
  OrvenGraphPanel,
} from './panel.js'

export const inject = ['slots', 'layout', 'sessions']

function OrvenPanelIcon({
  size,
}: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return createElement(IconBranchOutlineRegular, { size })
}

function installStyles(): () => void {
  const existing = document.querySelector<HTMLStyleElement>(
    'style[data-orven-graph-panel]',
  )
  if (existing !== null) return () => {}

  const style = document.createElement('style')
  style.dataset.orvenGraphPanel = 'true'
  style.textContent = ORVEN_PANEL_CSS
  document.head.append(style)
  return () => { style.remove() }
}

export function apply(ctx: ClientContext): void {
  const controller = new OrvenGraphController(
    ctx as unknown as OrvenClientContext,
  )
  ctx.effect(
    () => () => { controller.dispose() },
    'orven: graph controller',
  )
  ctx.effect(installStyles, 'orven: graph panel styles')

  const PanelEntry: SlotComponent<PropsRuntime<'main'>> = () =>
    createElement(OrvenGraphPanel, { controller })

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: ORVEN_PANEL_ID as MainPanelId,
  }, PanelEntry))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: ORVEN_PANEL_ID,
    order: 15,
    label: 'Orven',
  }, OrvenPanelIcon))
}
