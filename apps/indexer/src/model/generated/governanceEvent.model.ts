import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {GovernanceProposal} from "./governanceProposal.model"

@Entity_()
export class GovernanceEvent {
    constructor(props?: Partial<GovernanceEvent>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => GovernanceProposal, {nullable: true})
    proposal!: GovernanceProposal

    @StringColumn_({nullable: false})
    eventType!: string

    @StringColumn_({nullable: true})
    actor!: string | undefined | null

    @StringColumn_({nullable: true})
    reason!: string | undefined | null

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    blockNumber!: bigint

    @StringColumn_({nullable: false})
    transactionHash!: string
}
