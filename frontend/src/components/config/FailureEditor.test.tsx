import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FailureEditor } from './FailureEditor'
import type { Satellite, GroundSite, Failure, GatewayOutage } from '../../types/scenario'

describe('FailureEditor', () => {
  const satellites: Satellite[] = [
    { id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
    { id: 'S02', plane_id: 'P1', slot_deg: 22.5, launch_batch: 1 },
  ]
  const gateways: GroundSite[] = [
    { id: 'G_MUR', name: 'Мурманск', role: 'gateway', lat_deg: 68.97, lon_deg: 33.08 },
    { id: 'G_TIK', name: 'Тикси', role: 'gateway', lat_deg: 71.63, lon_deg: 128.87 },
  ]
  const failures: Failure[] = [
    { satellite_id: 'S01', start_s: 1000, end_s: 2000 },
  ]
  const gatewayOutages: GatewayOutage[] = [
    { gateway_id: 'G_MUR', start_s: 3000, end_s: 4000 },
  ]

  it('renders satellite failures and gateway outages list', () => {
    render(
      <FailureEditor
        satellites={satellites}
        gateways={gateways}
        failures={failures}
        gatewayOutages={gatewayOutages}
        onAddFailure={vi.fn()}
        onRemoveFailure={vi.fn()}
        onAddGatewayOutage={vi.fn()}
        onRemoveGatewayOutage={vi.fn()}
      />
    )

    expect(screen.getByText(/Отказы спутников \(1\)/)).toBeDefined()
    expect(screen.getByText(/Окна обслуживания наземных шлюзов \(1\)/)).toBeDefined()
    expect(screen.getByText('S01')).toBeDefined()
    expect(screen.getByText('G_MUR')).toBeDefined()
  })

  it('adds satellite failure with valid inputs', () => {
    const onAddFailure = vi.fn()
    render(
      <FailureEditor
        satellites={satellites}
        gateways={gateways}
        failures={[]}
        gatewayOutages={[]}
        onAddFailure={onAddFailure}
        onRemoveFailure={vi.fn()}
        onAddGatewayOutage={vi.fn()}
        onRemoveGatewayOutage={vi.fn()}
      />
    )

    const addButtons = screen.getAllByRole('button', { name: /Добавить/i })
    fireEvent.click(addButtons[0])

    expect(onAddFailure).toHaveBeenCalledTimes(1)
    expect(onAddFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        satellite_id: 'S01',
      })
    )
  })

  it('prevents adding satellite failure when start >= end', () => {
    const alertMock = vi.fn()
    window.alert = alertMock
    const onAddFailure = vi.fn()
    const { container } = render(
      <FailureEditor
        satellites={satellites}
        gateways={gateways}
        failures={[]}
        gatewayOutages={[]}
        onAddFailure={onAddFailure}
        onRemoveFailure={vi.fn()}
        onAddGatewayOutage={vi.fn()}
        onRemoveGatewayOutage={vi.fn()}
      />
    )

    // Set time inputs so start >= end
    const timeInputs = container.querySelectorAll('input[type="time"]')
    // First time input is start, second is end
    fireEvent.change(timeInputs[0], { target: { value: '14:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } })

    const addButtons = screen.getAllByRole('button', { name: /Добавить/i })
    fireEvent.click(addButtons[0])

    expect(alertMock).toHaveBeenCalled()
    expect(onAddFailure).not.toHaveBeenCalled()
    alertMock.mockRestore()
  })

  it('adds gateway outage with valid inputs', () => {
    const onAddGatewayOutage = vi.fn()
    render(
      <FailureEditor
        satellites={satellites}
        gateways={gateways}
        failures={[]}
        gatewayOutages={[]}
        onAddFailure={vi.fn()}
        onRemoveFailure={vi.fn()}
        onAddGatewayOutage={onAddGatewayOutage}
        onRemoveGatewayOutage={vi.fn()}
      />
    )

    const addButtons = screen.getAllByRole('button', { name: /Добавить/i })
    fireEvent.click(addButtons[1])

    expect(onAddGatewayOutage).toHaveBeenCalledTimes(1)
    expect(onAddGatewayOutage).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway_id: 'G_MUR',
      })
    )
  })

  it('prevents adding gateway outage when start >= end', () => {
    const alertMock = vi.fn()
    window.alert = alertMock
    const onAddGatewayOutage = vi.fn()
    const { container } = render(
      <FailureEditor
        satellites={satellites}
        gateways={gateways}
        failures={[]}
        gatewayOutages={[]}
        onAddFailure={vi.fn()}
        onRemoveFailure={vi.fn()}
        onAddGatewayOutage={onAddGatewayOutage}
        onRemoveGatewayOutage={vi.fn()}
      />
    )

    const timeInputs = container.querySelectorAll('input[type="time"]')
    // Third is gw start, fourth is gw end
    fireEvent.change(timeInputs[2], { target: { value: '15:00' } })
    fireEvent.change(timeInputs[3], { target: { value: '11:00' } })

    const addButtons = screen.getAllByRole('button', { name: /Добавить/i })
    fireEvent.click(addButtons[1])

    expect(alertMock).toHaveBeenCalled()
    expect(onAddGatewayOutage).not.toHaveBeenCalled()
    alertMock.mockRestore()
  })

  it('removes failure and gateway outage when delete buttons are clicked', () => {
    const onRemoveFailure = vi.fn()
    const onRemoveGatewayOutage = vi.fn()

    render(
      <FailureEditor
        satellites={satellites}
        gateways={gateways}
        failures={failures}
        gatewayOutages={gatewayOutages}
        onAddFailure={vi.fn()}
        onRemoveFailure={onRemoveFailure}
        onAddGatewayOutage={vi.fn()}
        onRemoveGatewayOutage={onRemoveGatewayOutage}
      />
    )

    const deleteButtons = screen.getAllByTitle(/Удалить/i)
    fireEvent.click(deleteButtons[0])
    expect(onRemoveFailure).toHaveBeenCalledWith(0)

    fireEvent.click(deleteButtons[1])
    expect(onRemoveGatewayOutage).toHaveBeenCalledWith(0)
  })
})
