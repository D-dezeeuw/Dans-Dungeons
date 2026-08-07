// Mounted Combat (SRD 5.2 § Combat — Mount). Pure helpers; the host
// owns the link via `actor.mountedOn = mountId` and the inverse
// `mount.riddenBy = riderId`. Controlled mounts act on the rider's
// initiative and follow the rider's chosen movement; independent
// mounts keep their own initiative and behave on their own.

/**
 * Mount one actor onto another. Returns `{ rider, mount }` with the
 * linkage stamped on both records. Cost: half the rider's speed
 * (per SRD). The host applies the speed cost via the encounter
 * budget; this helper just sets the linkage.
 *
 * Throws when:
 *   - The rider is already mounted (would clobber the link).
 *   - The mount is already ridden (collision).
 */
export function mount(rider, mountActor, { controlled = true } = {}) {
  if (!rider || typeof rider !== 'object') {
    throw new Error('mount: rider must be an actor object');
  }
  if (!mountActor || typeof mountActor !== 'object') {
    throw new Error('mount: mount must be an actor object');
  }
  if (rider.mountedOn) throw new Error(`mount: ${rider.id} is already mounted on ${rider.mountedOn}`);
  if (mountActor.riddenBy) throw new Error(`mount: ${mountActor.id} is already ridden by ${mountActor.riddenBy}`);
  return {
    rider: { ...rider, mountedOn: mountActor.id, mountControlled: controlled },
    mount: { ...mountActor, riddenBy: rider.id }
  };
}

/**
 * Dismount the rider. Returns `{ rider, mount }` with the linkage
 * cleared on both. Voluntary dismount costs half the rider's speed
 * (SRD); a forced dismount (e.g. mount knocked Prone) is free but
 * the rider lands Prone and falls take effect normally — engine
 * doesn't decide which, host passes `{ involuntary: true }` to
 * record it on the rider for the host's narrator to read.
 */
export function dismount(rider, mountActor, { involuntary = false } = {}) {
  if (!rider || typeof rider !== 'object') {
    throw new Error('dismount: rider must be an actor object');
  }
  if (!mountActor || typeof mountActor !== 'object') {
    throw new Error('dismount: mount must be an actor object');
  }
  if (rider.mountedOn !== mountActor.id) {
    throw new Error(`dismount: ${rider.id} is not mounted on ${mountActor.id}`);
  }
  const { mountedOn: _, mountControlled: __, ...nextRider } = rider;
  const { riddenBy: ___, ...nextMount } = mountActor;
  return {
    rider: involuntary ? { ...nextRider, justDismountedInvoluntarily: true } : nextRider,
    mount: nextMount
  };
}

/**
 * Read-only: is the rider currently mounted on this mount?
 */
export function isMountedOn(rider, mountActor) {
  return Boolean(rider?.mountedOn && mountActor?.id && rider.mountedOn === mountActor.id);
}

/**
 * SRD 5.2 § Combat — Mount: a controlled mount can take only the
 * Dash, Disengage, or Dodge action on its turn (it follows the
 * rider's initiative; the rider chooses the action). An independent
 * mount keeps its own initiative and full action menu. This helper
 * returns the legal actions for the mount given its control state.
 */
export const CONTROLLED_MOUNT_ACTIONS = Object.freeze(['dash', 'disengage', 'dodge']);

export function legalMountActions(mountActor) {
  if (!mountActor || mountActor.mountControlled === undefined) {
    // Default: independent mount, no restrictions.
    return null;
  }
  // Controlled by a rider.
  if (mountActor.riddenBy && mountActor.mountControlled !== false) {
    return [...CONTROLLED_MOUNT_ACTIONS];
  }
  return null;
}

export const MountedCombat = Object.freeze({
  mount,
  dismount,
  isMountedOn,
  legalMountActions,
  CONTROLLED_MOUNT_ACTIONS
});

export default MountedCombat;
