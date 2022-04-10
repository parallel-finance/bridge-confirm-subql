import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from '@subql/types'
import { Balance, Extrinsic } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import { BridgeTx } from '../types'

const POLKADOT_BRIDGE_ADDR = '16Q5tghTd2XnZcxssizmAnWNcx3WMoJTHyNaAkFoZQAh4w3q'
const POLKADOT_PROXY_ADDR = '145tUQ6JjEP9kL72Q9cfCaBLXKJM63oatvx7tAnQma9XVehV'

export async function handlePolkadotCall(
  extrinsic: SubstrateExtrinsic
): Promise<void> {
  const real = extrinsic.extrinsic.args[0].toString()
  const realExtrinsic = extrinsic.extrinsic.args[2] as Extrinsic
  if (!checkTransaction('utility', 'batchAll', realExtrinsic)) {
    return
  }
  const calls = realExtrinsic.args[0] as Vec<Extrinsic>
  logger.info(`real: ${real}, realExtrinsic: ${realExtrinsic.args.toString()}`)
  calls.forEach((call) => {
    logger.info(`call args: ${call.args.toString()}`)
  })

  if (
    calls.length < 2 ||
    !checkTransaction('system', 'remark', calls[1]) ||
    !checkTransaction('balances', 'transfer', calls[0])
  ) {
    return
  }
  const [
    {
      args: [addressRaw, amountRaw],
    },
    {
      args: [remarkRaw],
    },
  ] = calls.toArray()
  logger.info(
    `remarkRaw: ${remarkRaw}, addressRaw: ${addressRaw.toString()}, amountRaw: ${amountRaw.toString()}`
  )

  if (
    extrinsic.extrinsic.signer.toString() !== POLKADOT_PROXY_ADDR ||
    real !== POLKADOT_BRIDGE_ADDR
  ) {
    return
  }

  const blockHash = extrinsic.block.block.hash.toString()
  const extrinsicHash = extrinsic.extrinsic.hash.toString()

  const record = BridgeTx.create({
    id: `${blockHash}-${extrinsic}`,
    originHash: remarkRaw.toString(),
    address: addressRaw.toString(),
    amount: amountRaw.toString(),
    blockHeight: extrinsic.block.block.header.number.toNumber(),
    confirmationHash: extrinsic.block.block.hash.toString(),
  })

  logger.info(JSON.stringify(record))
  await record.save()
}
export async function handleCall(extrinsic: SubstrateExtrinsic): Promise<void> {
  await handlePolkadotCall(extrinsic)
}

const checkTransaction = (
  sectionFilter: string,
  methodFilter: string,
  call: Extrinsic
) => {
  const { section, method } = call.registry.findMetaCall(call.callIndex)
  return section === sectionFilter && method === methodFilter
}
