import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from '@subql/types'
import { Balance, Extrinsic } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import { BridgeTx } from '../types'

const PARALLEL_DOT_ASSET_ID = '101'
const PARALLEL_BRIDGE_ADDR = 'p8EAeCGH2HWrWWWCvUJz5ayFUC9GFrKByvr8AkosRHj3FKghS'
const POLKADOT_BRIDGE_ADDR = '158GuGBvLmKQNzuQdw3UNYTuxszu4WZzigQ7nhKzGfE7tRfg'

const parseRemark = (remark: { toString: () => string }) => {
  logger.info(`Remark is ${remark.toString()}`)
  return Buffer.from(remark.toString().slice(2), 'hex').toString('utf8')
}

export const isPolkadot = async (): Promise<boolean> => {
  const lastRuntimeUpgrade = await api.query.system.lastRuntimeUpgrade()
  if (lastRuntimeUpgrade.isNone) {
    throw new Error('unsupported chain')
  }
  return lastRuntimeUpgrade.unwrap().specName.toString() === 'polkadot'
}
export async function handlePolkadotCall(
  extrinsic: SubstrateExtrinsic
): Promise<void> {
  const calls = extrinsic.extrinsic.args[0] as Vec<Extrinsic>
  if (
    calls.length < 2 ||
    !checkTransaction('system', 'remark', calls[0]) ||
    !checkTransaction('balances', 'transfer', calls[1])
  ) {
    return
  }
  const [
    {
      args: [remarkRaw],
    },
    {
      args: [addressRaw, amountRaw],
    },
  ] = calls.toArray()

  if (extrinsic.extrinsic.signer.toString() !== POLKADOT_BRIDGE_ADDR) {
    return
  }

  const blockHash = extrinsic.block.block.hash.toString()
  const extrinsicHash = extrinsic.extrinsic.hash.toString()

  const record = BridgeTx.create({
    id: `${blockHash}-${extrinsic}`,
    originHash: parseRemark(remarkRaw),
    address: addressRaw.toString(),
    amount: amountRaw.toString(),
    blockHeight: extrinsic.block.block.header.number.toNumber(),
    confirmationHash: extrinsic.block.block.hash.toString(),
  })

  logger.info(JSON.stringify(record))
  await record.save()
}
export async function handleParallelCall(
  extrinsic: SubstrateExtrinsic
): Promise<void> {
  const calls = extrinsic.extrinsic.args[0] as Vec<Extrinsic>
  if (
    calls.length < 2 ||
    !checkTransaction('system', 'remark', calls[0]) ||
    !checkTransaction('assets', 'mint', calls[1])
  ) {
    return
  }
  const [
    {
      args: [remarkRaw],
    },
    {
      args: [assetIdRaw, addressRaw, amountRaw],
    },
  ] = calls.toArray()

  if (assetIdRaw.toString() !== PARALLEL_DOT_ASSET_ID) {
    return
  }

  if (extrinsic.extrinsic.signer.toString() !== PARALLEL_BRIDGE_ADDR) {
    return
  }

  const blockHash = extrinsic.block.block.hash.toString()
  const extrinsicHash = extrinsic.extrinsic.hash.toString()

  const record = BridgeTx.create({
    id: `${blockHash}-${extrinsic}`,
    originHash: parseRemark(remarkRaw),
    address: addressRaw.toString(),
    amount: amountRaw.toString(),
    blockHeight: extrinsic.block.block.header.number.toNumber(),
    confirmationHash: extrinsic.block.block.hash.toString(),
  })

  logger.info(JSON.stringify(record))
  await record.save()
}

async function handleCall(extrinsic: SubstrateExtrinsic): Promise<void> {
  const isPolka = await isPolkadot()
  if (isPolka) {
    await handlePolkadotCall(extrinsic)
  } else {
    await handleParallelCall(extrinsic)
  }
}

const checkTransaction = (
  sectionFilter: string,
  methodFilter: string,
  call: Extrinsic
) => {
  const { section, method } = call.registry.findMetaCall(call.callIndex)
  return section === sectionFilter && method === methodFilter
}
