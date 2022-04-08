import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from '@subql/types'
import { Balance, Extrinsic } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import { BridgeTx } from '../types'

const POLKADOT_BRIDGE_ADDR = '1egYCubF1U5CGWiXjQnsXduiJYP49KTs8eX1jn1JrTqCYyQ'
const POLKADOT_PROXY_ADDR = '15iswK1YfejPwJCgZjKkE4nL5MUYBxPdnfzbqMuk3pa147Qp'

const parseRemark = (remark: { toString: () => string }) => {
  logger.info(`Remark is ${remark.toString()}`)
  return Buffer.from(remark.toString().slice(2), 'hex').toString('utf8')
}

export async function handlePolkadotCall(
  extrinsic: SubstrateExtrinsic
): Promise<void> {
  const real = extrinsic.extrinsic.args[0].toString()
  const realExtrinsic = extrinsic.extrinsic.args[2] as Extrinsic
  const calls = realExtrinsic.args[0] as Vec<Extrinsic>

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
    originHash: parseRemark(remarkRaw),
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
