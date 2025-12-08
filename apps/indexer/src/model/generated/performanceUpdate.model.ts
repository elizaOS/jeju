import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {NodeStake} from "./nodeStake.model"

@Entity_()
export class PerformanceUpdate {
    constructor(props?: Partial<PerformanceUpdate>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => NodeStake, {nullable: true})
    node!: NodeStake

    @BigIntColumn_({nullable: false})
    uptimeScore!: bigint

    @BigIntColumn_({nullable: false})
    requestsServed!: bigint

    @BigIntColumn_({nullable: false})
    avgResponseTime!: bigint

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    blockNumber!: bigint

    @StringColumn_({nullable: false})
    transactionHash!: string
}
